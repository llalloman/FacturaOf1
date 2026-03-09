from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from datetime import timedelta, timezone as dt_timezone
import random
import string
import requests as http_requests

User = get_user_model()


def _generate_code():
    return ''.join(random.choices(string.digits, k=6))


def _send_verification_email(email: str, code: str):
    send_mail(
        subject='Código de verificación - OF1 Solutions',
        message=(
            f'Tu código de verificación es: {code}\n\n'
            f'Este código es válido por 30 minutos.\n\n'
            f'Si no solicitaste este código, ignora este mensaje.\n\n'
            f'OF1 Solutions S.A.S.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


def _user_dict(user, empresa=None):
    emp = empresa or user.empresa
    return {
        'id': user.id,
        'username': user.email,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'rol': user.rol,
        'empresa_id': emp.id if emp else None,
        'email_verificado': user.email_verificado,
        'onboarding_completado': emp.onboarding_completado if emp else False,
        'debe_cambiar_password': user.debe_cambiar_password,
    }


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        emp = self.user.empresa if hasattr(self.user, 'empresa') else None
        data['user'] = _user_dict(self.user, emp)
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Obtener información del usuario actual"""
    user = request.user
    return Response(_user_dict(user))

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout (invalida el token en el cliente)"""
    return Response({'detail': 'Logout exitoso'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def registro_empresa(request):
    """
    Registro público de nueva empresa.
    Crea Empresa + Usuario ADMIN_EMPRESA + Suscripcion PRUEBA en una sola transacción.
    Envía email de verificación y retorna JWT (email_verificado=False hasta confirmar).
    """
    from apps.empresas.models import Empresa
    from apps.suscripciones.models import PlanSuscripcion, Suscripcion

    data = request.data

    required = ['email', 'password', 'nombre', 'apellido']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return Response(
            {'error': f"Campos requeridos: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email_admin = data['email'].strip().lower()
    if User.objects.filter(email=email_admin).exists():
        return Response({'error': 'Ya existe un usuario con ese email.'}, status=status.HTTP_400_BAD_REQUEST)

    password = data['password']
    if len(password) < 8:
        return Response({'error': 'La contraseña debe tener al menos 8 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

    plan = PlanSuscripcion.objects.filter(activo=True).order_by('precio').first()
    plan_id = data.get('plan_id')
    if plan_id:
        try:
            plan = PlanSuscripcion.objects.get(id=plan_id, activo=True)
        except PlanSuscripcion.DoesNotExist:
            return Response({'error': 'El plan seleccionado no existe.'}, status=status.HTTP_400_BAD_REQUEST)
    if not plan:
        return Response({'error': 'No hay planes disponibles en este momento.'}, status=status.HTTP_400_BAD_REQUEST)

    # Generar código de verificación
    codigo = _generate_code()
    ahora = timezone.now()

    try:
        with transaction.atomic():
            # 1. Crear empresa provisional (sin RUC/certificado — se completa en onboarding)
            empresa = Empresa.objects.create(
                ruc='0000000000001',  # placeholder — se actualiza en onboarding
                razon_social='Por configurar',
                email=email_admin,
                telefono=data.get('telefono', '').strip(),
                direccion_matriz='Sin dirección',
                ciudad=data.get('ciudad', '').strip(),
                activa=True,
                ambiente='1',
                onboarding_completado=False,
            )

            # 2. Crear usuario ADMIN_EMPRESA
            usuario = User.objects.create_user(
                email=email_admin,
                password=password,
                first_name=data['nombre'].strip(),
                last_name=data['apellido'].strip(),
                cedula=data.get('cedula', '').strip() or None,
                telefono=data.get('telefono', '').strip(),
                rol='ADMIN_EMPRESA',
                empresa=empresa,
                email_verificado=False,
                codigo_verificacion=codigo,
                codigo_verificacion_expira=ahora + timedelta(minutes=30),
                intentos_reenvio=0,
            )

            # 3. Crear suscripción PRUEBA (30 días)
            Suscripcion.objects.create(
                empresa=empresa,
                plan=plan,
                estado='PRUEBA',
                fecha_inicio=ahora,
                fecha_fin=ahora + timedelta(days=30),
                auto_renovar=False,
            )
    except Exception as exc:
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 4. Enviar email de verificación
    try:
        _send_verification_email(email_admin, codigo)
    except Exception:
        pass  # No bloquear el registro si el email falla — el usuario puede reenviar

    # 5. Generar tokens JWT (auto-login, pero email_verificado=False)
    refresh = RefreshToken.for_user(usuario)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': _user_dict(usuario, empresa),
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verificar_email(request):
    """
    Verifica el código de 6 dígitos enviado al email del usuario.
    POST /api/auth/verificar-email/  { "codigo": "123456" }
    """
    user = request.user
    codigo = (request.data.get('codigo') or '').strip()

    if user.email_verificado:
        return Response({'detail': 'El email ya está verificado.'})

    if not codigo:
        return Response({'error': 'Código requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    ahora = timezone.now()

    if not user.codigo_verificacion or user.codigo_verificacion_expira is None:
        return Response({'error': 'No hay un código activo. Solicita uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)

    if ahora > user.codigo_verificacion_expira:
        return Response({'error': 'El código ha expirado. Solicita uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)

    if user.codigo_verificacion != codigo:
        return Response({'error': 'Código incorrecto.'}, status=status.HTTP_400_BAD_REQUEST)

    user.email_verificado = True
    user.codigo_verificacion = ''
    user.codigo_verificacion_expira = None
    user.save(update_fields=['email_verificado', 'codigo_verificacion', 'codigo_verificacion_expira'])

    return Response({'detail': 'Email verificado correctamente.', 'user': _user_dict(user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reenviar_codigo(request):
    """
    Reenvía el código de verificación.
    - Cooldown de 2 minutos entre reenvíos.
    - Máximo 3 intentos (luego debe registrarse de nuevo).
    POST /api/auth/reenviar-codigo/
    """
    user = request.user

    if user.email_verificado:
        return Response({'detail': 'El email ya está verificado.'})

    MAX_INTENTOS = 3
    COOLDOWN_SEGUNDOS = 120

    if user.intentos_reenvio >= MAX_INTENTOS:
        return Response(
            {'error': 'Has alcanzado el máximo de reenvíos. Registra una nueva cuenta.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    ahora = timezone.now()
    if user.ultimo_reenvio and (ahora - user.ultimo_reenvio).total_seconds() < COOLDOWN_SEGUNDOS:
        segundos_restantes = int(COOLDOWN_SEGUNDOS - (ahora - user.ultimo_reenvio).total_seconds())
        return Response(
            {'error': f'Espera {segundos_restantes} segundos antes de solicitar otro código.', 'segundos_restantes': segundos_restantes},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    codigo = _generate_code()
    user.codigo_verificacion = codigo
    user.codigo_verificacion_expira = ahora + timedelta(minutes=30)
    user.ultimo_reenvio = ahora
    user.intentos_reenvio = user.intentos_reenvio + 1
    user.save(update_fields=['codigo_verificacion', 'codigo_verificacion_expira', 'ultimo_reenvio', 'intentos_reenvio'])

    try:
        _send_verification_email(user.email, codigo)
    except Exception as exc:
        return Response({'error': f'No se pudo enviar el email: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    reenvios_restantes = MAX_INTENTOS - user.intentos_reenvio
    return Response({'detail': 'Código reenviado correctamente.', 'reenvios_restantes': reenvios_restantes})


@api_view(['GET'])
@permission_classes([AllowAny])
def consultar_ruc(request, ruc):
    """
    Consulta información de un contribuyente en el SRI por su RUC.
    GET /api/auth/consultar-ruc/<ruc>/
    """
    ruc = ruc.strip()
    if len(ruc) not in (10, 13) or not ruc.isdigit():
        return Response({'error': 'RUC/cédula inválido. Debe tener 10 o 13 dígitos.'}, status=status.HTTP_400_BAD_REQUEST)

    SRI_BASE = 'https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente'
    SRI_EXISTE  = f'{SRI_BASE}/existePorNumeroRuc?numeroRuc={ruc}'
    SRI_DETALLE = f'{SRI_BASE}/obtenerPorNumerosRuc?&ruc={ruc}'

    try:
        existe_resp = http_requests.get(SRI_EXISTE, timeout=10)
    except http_requests.Timeout:
        return Response(
            {'found': False, 'error': 'El servicio del SRI no respondió a tiempo. Ingresa los datos manualmente.'},
            status=status.HTTP_200_OK,
        )
    except Exception as exc:
        return Response(
            {'found': False, 'error': f'No se pudo conectar al SRI: {exc}. Ingresa los datos manualmente.'},
            status=status.HTTP_200_OK,
        )

    # existePorNumeroRuc devuelve true/false como texto o booleano JSON
    if existe_resp.status_code != 200:
        return Response(
            {'found': False, 'error': 'El SRI no devolvió información para ese RUC. Puedes ingresar los datos manualmente.'},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    try:
        existe = existe_resp.json()
    except Exception:
        existe = existe_resp.text.strip().lower() == 'true'

    if not existe:
        return Response(
            {'found': False, 'error': 'El RUC no existe o no está registrado en el SRI.'},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # Obtener datos del contribuyente
    try:
        detalle_resp = http_requests.get(SRI_DETALLE, timeout=10)
        detalle_resp.raise_for_status()
        sri_data = detalle_resp.json()
    except Exception:
        # Si falla el detalle pero el RUC existe, devolver found=True sin datos
        return Response({'found': True, 'ruc': ruc, 'razon_social': '', 'nombre_comercial': '',
                         'estado': '', 'tipo': '', 'direccion': ''})

    # obtenerPorNumerosRuc puede devolver un dict o una lista con un solo elemento
    if isinstance(sri_data, list):
        contribuyente = sri_data[0] if sri_data else {}
    else:
        contribuyente = sri_data if isinstance(sri_data, dict) else {}

    razon_social = (
        contribuyente.get('razonSocial') or
        contribuyente.get('nombreComercial') or
        ''
    )

    return Response({
        'found': True,
        'ruc': ruc,
        'razon_social': razon_social,
        'nombre_comercial': contribuyente.get('nombreComercial', '') or razon_social,
        'estado': contribuyente.get('estadoContribuyenteRuc', '') or contribuyente.get('estadoContribuyente', ''),
        'tipo': contribuyente.get('tipoContribuyente', ''),
        'actividad': contribuyente.get('actividadEconomicaPrincipal', ''),
        'direccion': contribuyente.get('direccionCompleta', ''),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validar_certificado(request):
    """
    Valida que un archivo .p12/.pfx:
    - Sea un certificado PKCS#12 válido con la contraseña proporcionada.
    - El RUC del sujeto del certificado coincida con el RUC indicado.
    POST /api/auth/validar-certificado/
    multipart: archivo=<file>, password=<str>, ruc=<str>
    """
    archivo = request.FILES.get('archivo')
    password = (request.data.get('password') or '').encode('utf-8')
    ruc = (request.data.get('ruc') or '').strip()

    if not archivo:
        return Response({'error': 'Archivo de certificado requerido.'}, status=status.HTTP_400_BAD_REQUEST)
    if not ruc:
        return Response({'error': 'RUC requerido para validar el certificado.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from cryptography.hazmat.primitives.serialization import pkcs12
        cert_data = archivo.read()
        private_key, certificate, _ = pkcs12.load_key_and_certificates(cert_data, password)
    except Exception:
        return Response({'error': 'Contraseña incorrecta o archivo de certificado inválido.'}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar que el RUC esté en el subject del certificado
    try:
        subject = certificate.subject
        subject_str = subject.rfc4514_string()
    except Exception:
        subject_str = ''

    if ruc not in subject_str:
        # Intentar también en el serial number o SAN
        try:
            from cryptography import x509
            san = certificate.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            san_str = str(san.value)
        except Exception:
            san_str = ''

        if ruc not in san_str:
            return Response(
                {'error': f'El certificado no corresponde al RUC {ruc}. Verifica que subiste el certificado correcto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # Obtener fecha de vencimiento
    not_after = certificate.not_valid_after_utc if hasattr(certificate, 'not_valid_after_utc') else certificate.not_valid_after
    if not_after.tzinfo is None:
        not_after = not_after.replace(tzinfo=dt_timezone.utc)  # not_valid_after is always UTC
    if timezone.now() > not_after:
        return Response({'error': 'El certificado está vencido.'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'valido': True,
        'fecha_vencimiento': not_after.strftime('%Y-%m-%d'),
        'subject': subject_str,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def completar_onboarding(request):
    """
    Guarda la configuración de la empresa y marca onboarding_completado=True.
    POST /api/auth/completar-onboarding/
    multipart/form-data (puede incluir certificado digital como archivo)
    """
    from apps.empresas.models import Empresa

    user = request.user
    if not user.empresa:
        return Response({'error': 'Sin empresa asociada.'}, status=status.HTTP_400_BAD_REQUEST)

    empresa = user.empresa
    data = request.data

    ruc = (data.get('ruc') or '').strip()
    if not ruc or len(ruc) != 13 or not ruc.isdigit():
        return Response({'error': 'RUC de 13 dígitos requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar que el RUC no esté en uso por OTRA empresa
    if Empresa.objects.filter(ruc=ruc).exclude(id=empresa.id).exists():
        return Response({'error': 'Ya existe otra empresa registrada con ese RUC.'}, status=status.HTTP_400_BAD_REQUEST)

    # Actualizar campos de empresa
    empresa.ruc = ruc
    empresa.razon_social = (data.get('razon_social') or '').strip() or empresa.razon_social
    empresa.nombre_comercial = (data.get('nombre_comercial') or '').strip()
    empresa.email = (data.get('email') or empresa.email).strip().lower()
    empresa.telefono = (data.get('telefono') or empresa.telefono or '').strip()
    empresa.ciudad = (data.get('ciudad') or '').strip()
    empresa.direccion_matriz = (data.get('direccion_matriz') or 'Sin dirección').strip()
    empresa.ambiente = data.get('ambiente', '1')
    empresa.establecimiento_codigo = (data.get('establecimiento_codigo') or '001').strip()
    empresa.punto_emision_codigo = (data.get('punto_emision_codigo') or '001').strip()

    # Tipo de contribuyente
    tipo_contrib = data.get('tipo_contribuyente', 'NATURAL')
    if tipo_contrib in ('NATURAL', 'SOCIEDAD', 'PUBLICA'):
        empresa.tipo_contribuyente = tipo_contrib

    # Certificado digital (opcional — puede subirse después)
    certificado = request.FILES.get('certificado_digital')
    if certificado:
        empresa.certificado_digital = certificado
        empresa.password_certificado = (data.get('password_certificado') or '').strip()
        fecha_venc = data.get('fecha_vencimiento_certificado')
        if fecha_venc:
            empresa.fecha_vencimiento_certificado = fecha_venc

    empresa.onboarding_completado = True
    empresa.save()

    return Response({'detail': 'Onboarding completado.', 'user': _user_dict(user, empresa)})


# ─────────────────────────────────────────────────────────────────────────────
# Recuperación de contraseña
# ─────────────────────────────────────────────────────────────────────────────

def _generate_temp_password(length=10):
    """Genera una contraseña temporal legible (sin caracteres ambiguos)."""
    chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(chars, k=length))


@api_view(['POST'])
@permission_classes([AllowAny])
def recuperar_password(request):
    """
    Genera una contraseña temporal y la envía al correo del usuario.
    POST /api/auth/recuperar-password/
    Body: { "email": "..." }
    """
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'El email es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    # Siempre responder OK aunque el email no exista (evitar enumeración de usuarios)
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        return Response({'detail': 'Si existe una cuenta con ese correo, recibirás las instrucciones en breve.'})

    temp_pass = _generate_temp_password()
    user.password_temporal = temp_pass  # guardamos en texto plano sólo para el envío
    user.password_temporal_expira = timezone.now() + timedelta(hours=2)
    user.debe_cambiar_password = True
    user.set_password(temp_pass)
    user.save(update_fields=['password', 'password_temporal', 'password_temporal_expira', 'debe_cambiar_password'])

    try:
        send_mail(
            subject='Contraseña temporal - OF1 Solutions',
            message=(
                f'Hola {user.first_name},\n\n'
                f'Recibimos una solicitud para restablecer tu contraseña.\n\n'
                f'Tu contraseña temporal es:\n\n'
                f'    {temp_pass}\n\n'
                f'Esta contraseña es válida por 2 horas. Al iniciar sesión te pediremos que la cambies.\n\n'
                f'Si no solicitaste este cambio, ignora este mensaje y tu cuenta seguirá segura.\n\n'
                f'— OF1 Solutions S.A.S.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        # Si falla el envío de email revertimos los cambios de contraseña
        user.debe_cambiar_password = False
        user.password_temporal = ''
        user.password_temporal_expira = None
        user.save(update_fields=['password_temporal', 'password_temporal_expira', 'debe_cambiar_password'])
        return Response(
            {'error': f'No se pudo enviar el correo. Contacta soporte. ({exc})'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response({'detail': 'Si existe una cuenta con ese correo, recibirás las instrucciones en breve.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_password(request):
    """
    Cambia la contraseña del usuario autenticado.
    Requerido cuando debe_cambiar_password=True (login con temporal).
    POST /api/auth/cambiar-password/
    Body: { "password_actual": "...", "password_nuevo": "..." }
    """
    password_actual = request.data.get('password_actual', '')
    password_nuevo = request.data.get('password_nuevo', '')

    if not password_actual or not password_nuevo:
        return Response({'error': 'Ambas contraseñas son requeridas.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(password_nuevo) < 8:
        return Response({'error': 'La nueva contraseña debe tener al menos 8 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if not user.check_password(password_actual):
        return Response({'error': 'La contraseña actual es incorrecta.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password_nuevo)
    user.debe_cambiar_password = False
    user.password_temporal = ''
    user.password_temporal_expira = None
    user.save(update_fields=['password', 'debe_cambiar_password', 'password_temporal', 'password_temporal_expira'])

    return Response({'detail': 'Contraseña actualizada correctamente.', 'user': _user_dict(user)})
