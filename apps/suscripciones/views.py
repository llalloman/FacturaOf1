from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from .models import PlanSuscripcion, Suscripcion
from .serializers import PlanSuscripcionSerializer, SuscripcionSerializer


def _is_super_admin(user):
    return user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN'


class PlanSuscripcionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista pública de planes activos (solo lectura)."""
    serializer_class = PlanSuscripcionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlanSuscripcion.objects.filter(activo=True).order_by('precio')


class SuscripcionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Suscripciones.
    - Usuarios normales: ven solo la de su empresa.
    - SUPER_ADMIN: ve todas + puede crear trials y gestionar estado.
    """
    serializer_class = SuscripcionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Suscripcion.objects.select_related('plan', 'empresa').order_by('-fecha_inicio')
        if _is_super_admin(user):
            empresa_id = self.request.query_params.get('empresa')
            if empresa_id:
                return qs.filter(empresa_id=empresa_id)
            return qs.all()
        empresa = getattr(user, 'empresa', None)
        if empresa:
            return qs.filter(empresa=empresa)
        return Suscripcion.objects.none()

    # ── Endpoint para todos: suscripción vigente de mi empresa ─────────────────
    @action(detail=False, methods=['get'])
    def activa(self, request):
        """Devuelve la suscripción activa/vigente de la empresa del usuario."""
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response({'detail': 'No tienes empresa asignada.'}, status=status.HTTP_404_NOT_FOUND)
        suscripcion = (
            Suscripcion.objects
            .select_related('plan', 'empresa')
            .filter(empresa=empresa)
            .exclude(estado='CANCELADA')
            .order_by('-fecha_inicio')
            .first()
        )
        if not suscripcion:
            return Response({'detail': 'No hay suscripción activa.'}, status=status.HTTP_404_NOT_FOUND)
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

