from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Agregar información del usuario
        data['user'] = {
            'id': self.user.id,
            'username': self.user.email,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'rol': self.user.rol,
            'empresa_id': self.user.empresa_id if hasattr(self.user, 'empresa') else None,
        }
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Obtener información del usuario actual"""
    user = request.user
    return Response({
        'id': user.id,
        'username': user.email,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'rol': user.rol,
        'empresa_id': user.empresa_id if hasattr(user, 'empresa') else None,
    })

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
    Retorna tokens JWT para auto-login inmediato.
    """
    from apps.empresas.models import Empresa
    from apps.suscripciones.models import PlanSuscripcion, Suscripcion

    data = request.data

    # Validaciones básicas
    required = ['ruc', 'razon_social', 'email_empresa', 'email', 'password', 'nombre', 'apellido']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return Response(
            {'error': f"Campos requeridos: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ruc = data['ruc'].strip()
    if len(ruc) != 13 or not ruc.isdigit():
        return Response({'error': 'El RUC debe tener exactamente 13 dígitos.'}, status=status.HTTP_400_BAD_REQUEST)

    if Empresa.objects.filter(ruc=ruc).exists():
        return Response({'error': 'Ya existe una empresa registrada con ese RUC.'}, status=status.HTTP_400_BAD_REQUEST)

    email_admin = data['email'].strip().lower()
    if User.objects.filter(email=email_admin).exists():
        return Response({'error': 'Ya existe un usuario con ese email.'}, status=status.HTTP_400_BAD_REQUEST)

    password = data['password']
    if len(password) < 8:
        return Response({'error': 'La contraseña debe tener al menos 8 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

    # Obtener el plan (el indicado o el más barato disponible)
    plan_id = data.get('plan_id')
    if plan_id:
        plan = PlanSuscripcion.objects.filter(id=plan_id, activo=True).first()
        if not plan:
            return Response({'error': 'Plan no encontrado o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        plan = PlanSuscripcion.objects.filter(activo=True).order_by('precio').first()
        if not plan:
            return Response({'error': 'No hay planes disponibles en este momento.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            # 1. Crear empresa
            empresa = Empresa.objects.create(
                ruc=ruc,
                razon_social=data['razon_social'].strip(),
                nombre_comercial=data.get('nombre_comercial', '').strip(),
                email=data['email_empresa'].strip().lower(),
                telefono=data.get('telefono', '').strip(),
                direccion_matriz=data.get('direccion', 'Sin dirección').strip(),
                activa=True,
                ambiente='1',  # Pruebas por defecto
            )

            # 2. Crear usuario ADMIN_EMPRESA
            usuario = User.objects.create_user(
                email=email_admin,
                password=password,
                first_name=data['nombre'].strip(),
                last_name=data['apellido'].strip(),
                rol='ADMIN_EMPRESA',
                empresa=empresa,
            )

            # 3. Crear suscripción PRUEBA (30 días)
            ahora = timezone.now()
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

    # 4. Generar tokens JWT (auto-login)
    refresh = RefreshToken.for_user(usuario)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': usuario.id,
            'username': usuario.email,
            'email': usuario.email,
            'first_name': usuario.first_name,
            'last_name': usuario.last_name,
            'rol': usuario.rol,
            'empresa_id': empresa.id,
        },
    }, status=status.HTTP_201_CREATED)
