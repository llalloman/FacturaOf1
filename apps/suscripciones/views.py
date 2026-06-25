from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta
from .models import PlanSuscripcion, Suscripcion, ModuloPermiso, ModuloSistema, SeccionModulo, MODULOS_BASE, get_todos_modulos_codigos
from .serializers import PlanSuscripcionSerializer, SuscripcionSerializer, ModuloPermisoSerializer, ModuloSistemaSerializer, SeccionModuloSerializer


def _is_super_admin(user):
    return user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'


TENANT_BLOCKED_MODULES = {'firmas_electronicas'}


def _tenant_visible_modules(codigos):
    return [codigo for codigo in codigos if codigo not in TENANT_BLOCKED_MODULES]


class PlanSuscripcionViewSet(viewsets.ModelViewSet):
    """Planes de suscripción. Lectura pública; escritura solo SUPER_ADMIN."""
    serializer_class = PlanSuscripcionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo']
    search_fields = ['nombre']
    ordering_fields = ['precio', 'nombre']
    ordering = ['precio']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # Escritura ve todos; lectura pública solo los activos
        if self.action in ('list', 'retrieve') and not (
            self.request.user.is_authenticated and _is_super_admin(self.request.user)
        ):
            return PlanSuscripcion.objects.filter(activo=True)
        return PlanSuscripcion.objects.all()

    def create(self, request, *args, **kwargs):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    # ── Permisos de módulos del plan ──────────────────────────────────────────
    @action(detail=True, methods=['get', 'put'], url_path='modulos')
    def modulos(self, request, pk=None):
        """
        GET  → Lista de códigos de módulo habilitados para este plan.
        PUT  → Reemplaza la lista completa. Body: { "modulos": ["facturacion", ...] }
        Solo SUPER_ADMIN.
        """
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        plan = self.get_object()
        if request.method == 'GET':
            codigos = list(
                ModuloPermiso.objects.filter(plan=plan).values_list('modulo', flat=True)
            )
            return Response({'plan_id': plan.id, 'modulos': codigos})
        # PUT — bulk replace
        ser = ModuloPermisoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        nuevos = set(_tenant_visible_modules(ser.validated_data['modulos']))
        ModuloPermiso.objects.filter(plan=plan).delete()
        ModuloPermiso.objects.bulk_create([
            ModuloPermiso(plan=plan, modulo=m) for m in nuevos
        ])
        return Response({'plan_id': plan.id, 'modulos': sorted(nuevos)})


class ModuloSistemaViewSet(viewsets.ModelViewSet):
    """Catálogo administrable de módulos/opciones. Solo SUPER_ADMIN."""
    serializer_class = ModuloSistemaSerializer
    permission_classes = [IsAuthenticated]
    queryset = ModuloSistema.objects.select_related('seccion').all().order_by('seccion__orden', 'grupo', 'orden', 'label')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo', 'grupo', 'seccion']
    search_fields = ['codigo', 'label', 'ruta', 'grupo', 'seccion__nombre']
    ordering_fields = ['seccion__orden', 'grupo', 'orden', 'label', 'codigo']
    ordering = ['seccion__orden', 'grupo', 'orden', 'label']

    def get_permissions(self):
        return [IsAuthenticated()]

    def _require_super_admin(self, request):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def list(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        modulo = self.get_object()
        ModuloPermiso.objects.filter(modulo=modulo.codigo).delete()
        return super().destroy(request, *args, **kwargs)


class SeccionModuloViewSet(viewsets.ModelViewSet):
    """Temas principales del catálogo de módulos. Solo SUPER_ADMIN."""
    serializer_class = SeccionModuloSerializer
    permission_classes = [IsAuthenticated]
    queryset = SeccionModulo.objects.all().order_by('orden', 'nombre')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo']
    search_fields = ['codigo', 'nombre']
    ordering_fields = ['orden', 'nombre', 'codigo']
    ordering = ['orden', 'nombre']

    def _require_super_admin(self, request):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def list(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._require_super_admin(request)
        if blocked:
            return blocked
        seccion = self.get_object()
        total_modulos = seccion.modulos.count()
        if total_modulos:
            return Response(
                {
                    'detail': (
                        f'No se puede eliminar el menú "{seccion.nombre}" porque tiene '
                        f'{total_modulos} submenú(s) asociado(s). Elimina o mueve primero esos submenús.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SuscripcionViewSet(viewsets.ModelViewSet):
    """
    Suscripciones.
    - Usuarios normales: ven solo la de su empresa.
    - SUPER_ADMIN: ve todas + CRUD completo + acciones de estado.
    """
    serializer_class = SuscripcionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estado', 'plan', 'empresa']
    search_fields = ['empresa__razon_social', 'plan__nombre']
    ordering_fields = ['fecha_inicio', 'fecha_fin']
    ordering = ['-fecha_inicio']

    def get_queryset(self):
        user = self.request.user
        qs = Suscripcion.objects.select_related('plan', 'empresa')
        if _is_super_admin(user):
            empresa_id = self.request.query_params.get('empresa')
            if empresa_id:
                return qs.filter(empresa_id=empresa_id)
            return qs.all()
        empresa = getattr(user, 'empresa', None)
        if empresa:
            return qs.filter(empresa=empresa)
        return Suscripcion.objects.none()

    def create(self, request, *args, **kwargs):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    # ── Endpoint para todos: suscripción vigente de mi empresa ─────────────────
    @action(detail=False, methods=['get'])
    def activa(self, request):
        """Devuelve la suscripción activa/vigente de la empresa del usuario."""
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response(None)
        suscripcion = (
            Suscripcion.objects
            .select_related('plan', 'empresa')
            .filter(empresa=empresa)
            .exclude(estado='CANCELADA')
            .order_by('-fecha_inicio')
            .first()
        )
        if not suscripcion:
            return Response(None)
        return Response(SuscripcionSerializer(suscripcion).data)

    # ── Resumen general para el panel SUPER_ADMIN ──────────────────────────────
    @action(detail=False, methods=['get'], url_path='resumen-admin')
    def resumen_admin(self, request):
        """
        Vista consolidada: cada empresa con su suscripción más reciente.
        Solo accesible por SUPER_ADMIN.
        """
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.empresas.models import Empresa
        from django.db.models import OuterRef, Subquery, CharField
        now = timezone.now()

        empresas = Empresa.objects.all().order_by('razon_social')

        resultado = []
        for emp in empresas:
            sus = (
                Suscripcion.objects
                .filter(empresa=emp)
                .exclude(estado='CANCELADA')
                .select_related('plan')
                .order_by('-fecha_inicio')
                .first()
            )
            resultado.append({
                'empresa_id': emp.id,
                'empresa_ruc': emp.ruc,
                'empresa_nombre': emp.razon_social,
                'empresa_activa': emp.activa,
                'suscripcion': SuscripcionSerializer(sus).data if sus else None,
            })

        return Response(resultado)

    # ── SUPER_ADMIN: crear período de prueba para una empresa ─────────────────
    @action(detail=False, methods=['post'], url_path='crear-trial')
    def crear_trial(self, request):
        """
        Crea una suscripción en estado PRUEBA (30 días) para una empresa.
        Requiere: { empresa_id, plan_id, dias_prueba (opcional, default 30) }
        Solo SUPER_ADMIN.
        """
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.empresas.models import Empresa
        empresa_id = request.data.get('empresa_id')
        plan_id = request.data.get('plan_id')
        dias = int(request.data.get('dias_prueba', 30))

        if not empresa_id or not plan_id:
            return Response({'error': 'empresa_id y plan_id son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            empresa = Empresa.objects.get(id=empresa_id)
            plan = PlanSuscripcion.objects.get(id=plan_id)
        except (Empresa.DoesNotExist, PlanSuscripcion.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        # Cancelar suscripción anterior si existe
        Suscripcion.objects.filter(
            empresa=empresa,
            estado__in=['ACTIVA', 'PRUEBA', 'SUSPENDIDA']
        ).update(estado='CANCELADA')

        ahora = timezone.now()
        suscripcion = Suscripcion.objects.create(
            empresa=empresa,
            plan=plan,
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=dias),
            fecha_proximo_pago=ahora + timedelta(days=dias),
            estado=Suscripcion.EstadoChoices.PRUEBA,
            auto_renovar=False,
        )
        # Reactivar la empresa si estaba inactiva
        empresa.activa = True
        empresa.save(update_fields=['activa'])

        return Response(SuscripcionSerializer(suscripcion).data, status=status.HTTP_201_CREATED)

    # ── SUPER_ADMIN: activar suscripción ──────────────────────────────────────
    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """Activa una suscripción (PRUEBA → ACTIVA). Solo SUPER_ADMIN."""
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        suscripcion = self.get_object()
        suscripcion.estado = Suscripcion.EstadoChoices.ACTIVA
        suscripcion.save(update_fields=['estado'])
        suscripcion.empresa.activa = True
        suscripcion.empresa.save(update_fields=['activa'])
        return Response(SuscripcionSerializer(suscripcion).data)

    # ── SUPER_ADMIN: suspender ────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def suspender(self, request, pk=None):
        """Suspende una suscripción y desactiva la empresa. Solo SUPER_ADMIN."""
        if not _is_super_admin(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        suscripcion = self.get_object()
        suscripcion.suspender()
        suscripcion.empresa.activa = False
        suscripcion.empresa.save(update_fields=['activa'])
        return Response(SuscripcionSerializer(suscripcion).data)

    # ── Renovar (cualquier admin o super) ────────────────────────────────────
    @action(detail=True, methods=['post'])
    def renovar(self, request, pk=None):
        suscripcion = self.get_object()
        try:
            suscripcion.renovar()
            suscripcion.empresa.activa = True
            suscripcion.empresa.save(update_fields=['activa'])
            return Response(SuscripcionSerializer(suscripcion).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ── Cancelar ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        suscripcion = self.get_object()
        suscripcion.cancelar()
        return Response(SuscripcionSerializer(suscripcion).data)

    # ── Cambiar plan (empresa admin) ───────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='cambiar-plan')
    def cambiar_plan(self, request):
        """
        Cambia el plan de la suscripción activa de la empresa del usuario.
        Requiere: { plan_id }
        Crea una nueva suscripción con el plan elegido (duración según el plan).
        """
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response(None)

        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response({'error': 'plan_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = PlanSuscripcion.objects.get(id=plan_id, activo=True)
        except PlanSuscripcion.DoesNotExist:
            return Response({'error': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Cancelar suscripciones activas anteriores
        Suscripcion.objects.filter(
            empresa=empresa,
            estado__in=['ACTIVA', 'PRUEBA', 'SUSPENDIDA', 'VENCIDA'],
        ).update(estado='CANCELADA')

        ahora = timezone.now()
        dias = plan.get_dias_periodo()
        nueva = Suscripcion.objects.create(
            empresa=empresa,
            plan=plan,
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=dias),
            fecha_proximo_pago=ahora + timedelta(days=dias),
            estado=Suscripcion.EstadoChoices.ACTIVA,
            auto_renovar=True,
        )
        empresa.activa = True
        empresa.save(update_fields=['activa'])

        return Response(SuscripcionSerializer(nueva).data, status=status.HTTP_201_CREATED)

    # ── Toggle auto-renovar ───────────────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='toggle-auto-renovar')
    def toggle_auto_renovar(self, request):
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response(None)

        suscripcion = (
            Suscripcion.objects
            .filter(empresa=empresa)
            .exclude(estado='CANCELADA')
            .order_by('-fecha_inicio')
            .first()
        )
        if not suscripcion:
            return Response({'detail': 'No hay suscripción activa.'}, status=status.HTTP_404_NOT_FOUND)

        enabled = request.data.get('enabled')
        if enabled is None:
            suscripcion.auto_renovar = not suscripcion.auto_renovar
        else:
            suscripcion.auto_renovar = bool(enabled)
        suscripcion.save(update_fields=['auto_renovar'])

        return Response(SuscripcionSerializer(suscripcion).data)


# ── Endpoints funcionales (no ViewSet) ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalogo_modulos(request):
    """Devuelve el catálogo completo de módulos disponibles en el sistema."""
    try:
        modulos = list(
            ModuloSistema.objects
            .select_related('seccion')
            .filter(activo=True)
            .order_by('seccion__orden', 'grupo', 'orden', 'label')
        )
    except Exception:
        modulos = []
    if modulos:
        return Response(ModuloSistemaSerializer(modulos, many=True).data)
    return Response([{**m, 'activo': m.get('activo', True), 'external': m.get('external', False)} for m in MODULOS_BASE])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mis_modulos(request):
    """
    Devuelve la lista de módulos a los que el usuario actual tiene acceso,
    basado en el plan de suscripción activo de su empresa.
    - SUPER_ADMIN: acceso a todos los módulos.
    - Empresa sin suscripción activa: lista vacía.
    """
    user = request.user
    if getattr(user, 'rol', None) == 'SUPER_ADMIN' or user.is_superuser:
        return Response({'modulos': _tenant_visible_modules(get_todos_modulos_codigos())})

    empresa = getattr(user, 'empresa', None)
    if not empresa:
        return Response({'modulos': []})

    suscripcion = (
        Suscripcion.objects
        .filter(empresa=empresa, estado__in=['ACTIVA', 'PRUEBA'])
        .select_related('plan')
        .order_by('-fecha_inicio')
        .first()
    )
    if not suscripcion:
        return Response({'modulos': []})

    # Durante el período de prueba el usuario accede a todo
    if suscripcion.estado == 'PRUEBA':
        return Response({'modulos': _tenant_visible_modules(get_todos_modulos_codigos())})

    codigos = _tenant_visible_modules(list(
        ModuloPermiso.objects.filter(plan=suscripcion.plan).values_list('modulo', flat=True)
    ))
    return Response({'modulos': codigos})
