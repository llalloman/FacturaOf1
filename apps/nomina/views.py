from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    ConceptoEmpleadoNomina,
    DetalleRolPago,
    Empleado,
    PagoRol,
    ParametroNomina,
    RolPago,
    RubroNomina,
)
from .serializers import (
    ConceptoEmpleadoNominaSerializer,
    DetalleRolPagoSerializer,
    EmpleadoSerializer,
    MarcarPagadoRolSerializer,
    PagoRolSerializer,
    ParametroNominaSerializer,
    RolPagoCreateSerializer,
    RolPagoSerializer,
    RubroNominaSerializer,
)
from apps.core.permissions import HasModuleAccess


DEFAULT_RUBROS = [
    {'codigo': 'SUELDO_BASE', 'nombre': 'Sueldo base', 'tipo': 'INGRESO', 'aplica_iess': True, 'aplica_ir': True, 'automatico': True, 'orden': 10},
    {'codigo': 'HORAS_EXTRA_25', 'nombre': 'Horas extra 25%', 'tipo': 'INGRESO', 'aplica_iess': True, 'aplica_ir': True, 'orden': 20},
    {'codigo': 'HORAS_EXTRA_100', 'nombre': 'Horas extra 100%', 'tipo': 'INGRESO', 'aplica_iess': True, 'aplica_ir': True, 'orden': 30},
    {'codigo': 'COMISIONES', 'nombre': 'Comisiones', 'tipo': 'INGRESO', 'aplica_iess': True, 'aplica_ir': True, 'orden': 40},
    {'codigo': 'BONOS', 'nombre': 'Bonos', 'tipo': 'INGRESO', 'aplica_iess': True, 'aplica_ir': True, 'orden': 50},
    {'codigo': 'OTROS_INGRESOS', 'nombre': 'Otros ingresos', 'tipo': 'INGRESO', 'aplica_iess': False, 'aplica_ir': True, 'orden': 90},
    {'codigo': 'IMPUESTO_RENTA', 'nombre': 'Impuesto a la renta retenido', 'tipo': 'DESCUENTO', 'es_recurrente': False, 'orden': 120},
    {'codigo': 'ANTICIPOS', 'nombre': 'Anticipos', 'tipo': 'DESCUENTO', 'orden': 130},
    {'codigo': 'OTROS_DESCUENTOS', 'nombre': 'Otros descuentos', 'tipo': 'DESCUENTO', 'orden': 190},
]


def ensure_default_rubros(empresa):
    rubros = {}
    for data in DEFAULT_RUBROS:
        rubro, _ = RubroNomina.objects.get_or_create(
            empresa=empresa,
            codigo=data['codigo'],
            defaults={
                'nombre': data['nombre'],
                'tipo': data['tipo'],
                'aplica_iess': data.get('aplica_iess', False),
                'aplica_ir': data.get('aplica_ir', False),
                'es_recurrente': data.get('es_recurrente', True),
                'automatico': data.get('automatico', False),
                'orden': data.get('orden', 100),
            },
        )
        rubros[rubro.codigo] = rubro
    return rubros


def periodo_fecha(anio, mes):
    return date(int(anio), int(mes), 1)


class EmpleadoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'nomina'
    serializer_class = EmpleadoSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estado']
    search_fields = ['cedula', 'nombres', 'apellidos', 'email']
    ordering_fields = ['apellidos', 'fecha_ingreso', 'sueldo_base']
    ordering = ['apellidos']

    def get_queryset(self):
        return Empleado.objects.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    @transaction.atomic
    @action(detail=False, methods=['post'])
    def generar_roles(self, request):
        """
        Genera roles de pago en borrador para todos los empleados activos.
        Body: {anio: 2026, mes: 1}
        """
        anio = request.data.get('anio')
        mes = request.data.get('mes')
        if not anio or not mes:
            return Response({'detail': 'Se requieren anio y mes.'}, status=400)

        empresa = request.user.empresa
        rubros = ensure_default_rubros(empresa)
        fecha_periodo = periodo_fecha(anio, mes)
        empleados = Empleado.objects.filter(empresa=empresa, estado=Empleado.EstadoChoices.ACTIVO)
        creados = 0
        existentes = 0

        for emp in empleados:
            rol, created = RolPago.objects.get_or_create(
                empresa=empresa,
                empleado=emp,
                anio=anio,
                mes=mes,
                defaults={
                    'sueldo_base': emp.sueldo_base,
                    'estado': RolPago.EstadoChoices.BORRADOR,
                },
            )
            if created:
                DetalleRolPago.objects.create(
                    rol=rol,
                    rubro=rubros['SUELDO_BASE'],
                    descripcion='Sueldo base',
                    cantidad=Decimal('1.00'),
                    valor_unitario=emp.sueldo_base,
                    orden=10,
                    automatico=True,
                )
                conceptos = ConceptoEmpleadoNomina.objects.filter(
                    empresa=empresa,
                    empleado=emp,
                    activo=True,
                    rubro__activo=True,
                ).select_related('rubro')
                for concepto in conceptos:
                    if not concepto.vigente_en(fecha_periodo):
                        continue
                    DetalleRolPago.objects.create(
                        rol=rol,
                        rubro=concepto.rubro,
                        descripcion=concepto.descripcion or concepto.rubro.nombre,
                        cantidad=Decimal('1.00'),
                        valor_unitario=concepto.valor,
                        orden=concepto.rubro.orden,
                    )
                rol.save()
                creados += 1
            else:
                existentes += 1

        return Response({
            'creados': creados,
            'existentes': existentes,
            'detail': f'{creados} roles generados, {existentes} ya existían.',
        })


class ParametroNominaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'nomina'
    serializer_class = ParametroNominaSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['anio', 'activo']
    ordering = ['-anio']

    def get_queryset(self):
        return ParametroNomina.objects.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


class RubroNominaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'nomina'
    serializer_class = RubroNominaSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'activo', 'aplica_iess', 'es_recurrente']
    search_fields = ['codigo', 'nombre']
    ordering_fields = ['tipo', 'orden', 'nombre']
    ordering = ['tipo', 'orden', 'nombre']

    def get_queryset(self):
        return RubroNomina.objects.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    @action(detail=False, methods=['post'])
    def sembrar_base(self, request):
        ensure_default_rubros(request.user.empresa)
        return Response({'detail': 'Rubros base disponibles.'})


class ConceptoEmpleadoNominaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'nomina'
    serializer_class = ConceptoEmpleadoNominaSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['empleado', 'rubro', 'activo']
    search_fields = ['empleado__nombres', 'empleado__apellidos', 'rubro__nombre', 'descripcion']
    ordering = ['empleado__apellidos', 'rubro__orden']

    def get_queryset(self):
        return ConceptoEmpleadoNomina.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('empleado', 'rubro')

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


class RolPagoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'nomina'
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['anio', 'mes', 'empleado', 'estado']
    search_fields = ['empleado__nombres', 'empleado__apellidos', 'empleado__cedula']
    ordering_fields = ['anio', 'mes', 'total_ingresos', 'liquido_a_pagar']
    ordering = ['-anio', '-mes']

    def get_queryset(self):
        return RolPago.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('empleado').prefetch_related('detalles__rubro')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return RolPagoCreateSerializer
        return RolPagoSerializer

    def perform_destroy(self, instance):
        if instance.estado != RolPago.EstadoChoices.BORRADOR:
            raise serializers.ValidationError({'detail': 'Solo se pueden eliminar roles en borrador.'})
        instance.delete()

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        rol = self.get_object()
        if rol.estado != RolPago.EstadoChoices.BORRADOR:
            return Response({'detail': 'Solo roles en borrador pueden aprobarse.'}, status=400)
        rol.estado = RolPago.EstadoChoices.APROBADO
        rol.save()
        return Response(RolPagoSerializer(rol).data)

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def marcar_pagado(self, request, pk=None):
        rol = self.get_object()
        if rol.estado != RolPago.EstadoChoices.APROBADO:
            return Response({'detail': 'Solo roles aprobados pueden marcarse como pagados.'}, status=400)

        serializer = MarcarPagadoRolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cuenta = None
        cuenta_id = data.get('cuenta_bancaria')
        if cuenta_id:
            from apps.bancos.models import CuentaBancaria, MovimientoBancario
            try:
                cuenta = CuentaBancaria.objects.get(id=cuenta_id, empresa=rol.empresa, activa=True)
            except CuentaBancaria.DoesNotExist:
                return Response({'detail': 'Cuenta bancaria no encontrada o inactiva.'}, status=404)

        pago = PagoRol.objects.create(
            rol=rol,
            cuenta_bancaria=cuenta,
            fecha_pago=data.get('fecha_pago') or timezone.localdate(),
            monto=rol.liquido_a_pagar,
            referencia=data.get('referencia', ''),
            notas=data.get('notas', ''),
        )
        if cuenta:
            movimiento = MovimientoBancario.objects.create(
                cuenta=cuenta,
                fecha=pago.fecha_pago,
                tipo='PAGO',
                descripcion=f'Pago nómina {rol.empleado.nombre_completo} {rol.mes}/{rol.anio}',
                referencia=pago.referencia or f'NOM-{rol.id}',
                monto=pago.monto,
                conciliado=False,
                beneficiario=rol.empleado.nombre_completo,
                notas=f'Generado automáticamente desde rol de pago {rol.id}.',
            )
            pago.movimiento_bancario = movimiento
            pago.save(update_fields=['movimiento_bancario'])

        rol.estado = RolPago.EstadoChoices.PAGADO
        rol.save()
        return Response(RolPagoSerializer(rol).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Resumen de nómina para un período."""
        anio = request.query_params.get('anio')
        mes = request.query_params.get('mes')
        qs = self.get_queryset()
        if anio:
            qs = qs.filter(anio=anio)
        if mes:
            qs = qs.filter(mes=mes)

        agg = qs.aggregate(
            total_ingresos=Sum('total_ingresos'),
            total_descuentos=Sum('total_descuentos'),
            total_liquido=Sum('liquido_a_pagar'),
            total_aporte_patronal=Sum('aporte_patronal'),
            total_decimo_tercero=Sum('decimo_tercero'),
            total_decimo_cuarto=Sum('decimo_cuarto'),
            total_vacaciones=Sum('vacaciones'),
        )
        return Response({
            'anio': anio,
            'mes': mes,
            'empleados': qs.count(),
            'total_ingresos': float(agg['total_ingresos'] or 0),
            'total_descuentos': float(agg['total_descuentos'] or 0),
            'total_liquido': float(agg['total_liquido'] or 0),
            'total_aporte_patronal': float(agg['total_aporte_patronal'] or 0),
            'total_decimo_tercero': float(agg['total_decimo_tercero'] or 0),
            'total_decimo_cuarto': float(agg['total_decimo_cuarto'] or 0),
            'total_vacaciones': float(agg['total_vacaciones'] or 0),
        })


class DetalleRolPagoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    module_required = 'nomina'
    serializer_class = DetalleRolPagoSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['rol', 'tipo', 'rubro']
    ordering = ['tipo', 'orden', 'id']

    def get_queryset(self):
        return DetalleRolPago.objects.filter(
            rol__empresa=self.request.user.empresa
        ).select_related('rol', 'rubro')

    def _ensure_editable(self, rol):
        if rol.estado != RolPago.EstadoChoices.BORRADOR:
            raise serializers.ValidationError({'detail': 'Solo se pueden editar detalles de roles en borrador.'})

    def perform_create(self, serializer):
        rol = serializer.validated_data['rol']
        if rol.empresa_id != self.request.user.empresa_id:
            raise serializers.ValidationError({'rol': 'El rol no pertenece a la empresa.'})
        self._ensure_editable(rol)
        detalle = serializer.save()
        detalle.rol.save()

    def perform_update(self, serializer):
        self._ensure_editable(serializer.instance.rol)
        detalle = serializer.save()
        detalle.rol.save()

    def perform_destroy(self, instance):
        self._ensure_editable(instance.rol)
        rol = instance.rol
        instance.delete()
        rol.save()
