from decimal import Decimal
from django.db.models import Sum
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Empleado, RolPago
from .serializers import EmpleadoSerializer, RolPagoSerializer, RolPagoCreateSerializer


class EmpleadoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
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

    @action(detail=False, methods=['post'])
    def generar_roles(self, request):
        """
        Genera roles de pago en borrador para todos los empleados activos.
        Body: {anio: 2025, mes: 1}
        """
        anio = request.data.get('anio')
        mes  = request.data.get('mes')
        if not anio or not mes:
            return Response({'detail': 'Se requieren anio y mes.'}, status=400)

        empresa = request.user.empresa
        empleados = Empleado.objects.filter(empresa=empresa, estado='ACTIVO')
        creados = 0
        existentes = 0

        for emp in empleados:
            _, created = RolPago.objects.get_or_create(
                empresa=empresa,
                empleado=emp,
                anio=anio,
                mes=mes,
                defaults={
                    'sueldo_base': emp.sueldo_base,
                    'estado': 'BORRADOR',
                }
            )
            if created:
                creados += 1
            else:
                existentes += 1

        return Response({
            'creados': creados,
            'existentes': existentes,
            'detail': f'{creados} roles generados, {existentes} ya existían.',
        })


class RolPagoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['anio', 'mes', 'empleado', 'estado']
    search_fields = ['empleado__nombres', 'empleado__apellidos', 'empleado__cedula']
    ordering_fields = ['anio', 'mes', 'total_ingresos', 'liquido_a_pagar']
    ordering = ['-anio', '-mes']

    def get_queryset(self):
        return RolPago.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('empleado')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return RolPagoCreateSerializer
        return RolPagoSerializer

    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        rol = self.get_object()
        if rol.estado != 'BORRADOR':
            return Response({'detail': 'Solo roles en borrador pueden aprobarse.'}, status=400)
        rol.estado = 'APROBADO'
        rol.save()
        return Response(RolPagoSerializer(rol).data)

    @action(detail=True, methods=['post'])
    def marcar_pagado(self, request, pk=None):
        rol = self.get_object()
        if rol.estado != 'APROBADO':
            return Response({'detail': 'Solo roles aprobados pueden marcarse como pagados.'}, status=400)
        rol.estado = 'PAGADO'
        rol.save()
        return Response(RolPagoSerializer(rol).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Resumen de nómina para un período."""
        anio = request.query_params.get('anio')
        mes  = request.query_params.get('mes')
        qs = self.get_queryset()
        if anio: qs = qs.filter(anio=anio)
        if mes:  qs = qs.filter(mes=mes)

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
            'mes':  mes,
            'empleados': qs.count(),
            'total_ingresos':       float(agg['total_ingresos']       or 0),
            'total_descuentos':     float(agg['total_descuentos']     or 0),
            'total_liquido':        float(agg['total_liquido']        or 0),
            'total_aporte_patronal':float(agg['total_aporte_patronal']or 0),
            'total_decimo_tercero': float(agg['total_decimo_tercero'] or 0),
            'total_decimo_cuarto':  float(agg['total_decimo_cuarto']  or 0),
            'total_vacaciones':     float(agg['total_vacaciones']     or 0),
        })
