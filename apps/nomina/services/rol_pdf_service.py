from io import BytesIO
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.nomina.models import PagoRol, RubroNomina

MESES_NOMINA = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


def money_text(value):
    return f"${Decimal(value or 0):,.2f}"


def periodo_text(rol):
    return f"{MESES_NOMINA[rol.mes]} {rol.anio}" if 0 < int(rol.mes) < len(MESES_NOMINA) else f"{rol.mes}/{rol.anio}"


def _table_style(header_bg=colors.HexColor('#f3f4f6')):
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#111827')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#d1d5db')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ])


def _money_rows(detalles, empty_label):
    rows = [['Concepto', 'Cantidad', 'Valor unitario', 'Total']]
    if not detalles:
        rows.append([empty_label, '', '', money_text(0)])
        return rows
    for detalle in detalles:
        rows.append([
            detalle.descripcion or getattr(detalle.rubro, 'nombre', '') or 'Concepto',
            str(detalle.cantidad),
            money_text(detalle.valor_unitario),
            money_text(detalle.valor_total),
        ])
    return rows


def generar_rol_pago_pdf(rol) -> bytes:
    empresa = rol.empresa
    empleado = rol.empleado
    detalles = list(rol.detalles.select_related('rubro').all())
    ingresos = [d for d in detalles if d.tipo == RubroNomina.TipoChoices.INGRESO]
    descuentos = [d for d in detalles if d.tipo == RubroNomina.TipoChoices.DESCUENTO]
    empleado_asegurado = bool(getattr(empleado, 'afiliado_iess', False))
    total_provisiones = sum(Decimal(v or 0) for v in [
        rol.aporte_patronal,
        rol.decimo_tercero,
        rol.decimo_cuarto,
        rol.fondos_reserva,
        rol.vacaciones,
    ])

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )

    styles = getSampleStyleSheet()
    normal = styles['Normal']
    small = ParagraphStyle('small', parent=normal, fontSize=8)
    title = ParagraphStyle('title', parent=normal, fontSize=14, fontName='Helvetica-Bold', alignment=TA_CENTER)
    subtitle = ParagraphStyle('subtitle', parent=normal, fontSize=9, alignment=TA_CENTER)
    right = ParagraphStyle('right', parent=normal, fontSize=8, alignment=TA_RIGHT)
    heading = ParagraphStyle('heading', parent=normal, fontSize=9, fontName='Helvetica-Bold')

    story = [
        Paragraph('ROL DE PAGO', title),
        Paragraph(periodo_text(rol), subtitle),
        Spacer(1, 8),
    ]

    empresa_data = [
        [Paragraph('<b>Empresa</b>', small), Paragraph(str(getattr(empresa, 'razon_social', '') or empresa), small)],
        [Paragraph('<b>RUC</b>', small), Paragraph(getattr(empresa, 'ruc', '') or '-', small)],
        [Paragraph('<b>Empleado</b>', small), Paragraph(empleado.nombre_completo, small)],
        [Paragraph('<b>Identificación</b>', small), Paragraph(empleado.cedula or '-', small)],
        [Paragraph('<b>Cargo</b>', small), Paragraph(empleado.cargo or '-', small)],
        [Paragraph('<b>Estado</b>', small), Paragraph(rol.estado, small)],
        [Paragraph('<b>Afiliado IESS</b>', small), Paragraph('Sí' if empleado_asegurado else 'No', small)],
    ]
    info_table = Table(empresa_data, colWidths=[35 * mm, 135 * mm])
    info_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f9fafb')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story += [info_table, Spacer(1, 10)]

    story += [Paragraph('Ingresos', heading)]
    ingresos_table = Table(_money_rows(ingresos, 'Sin ingresos registrados'), colWidths=[85 * mm, 25 * mm, 30 * mm, 30 * mm])
    ingresos_table.setStyle(_table_style(colors.HexColor('#dcfce7')))
    story += [ingresos_table, Spacer(1, 8)]

    story += [Paragraph('Descuentos', heading)]
    descuento_rows = _money_rows(descuentos, 'Sin descuentos registrados')
    if empleado_asegurado and Decimal(rol.aporte_personal or 0) > 0:
        descuento_rows.insert(1, ['Aporte personal IESS', '1.00', money_text(rol.aporte_personal), money_text(rol.aporte_personal)])
    descuentos_table = Table(descuento_rows, colWidths=[85 * mm, 25 * mm, 30 * mm, 30 * mm])
    descuentos_table.setStyle(_table_style(colors.HexColor('#fee2e2')))
    story += [descuentos_table, Spacer(1, 8)]

    resumen_rows = [
        ['Total ingresos', money_text(rol.total_ingresos)],
        ['Total descuentos', money_text(rol.total_descuentos)],
        ['Líquido a pagar', money_text(rol.liquido_a_pagar)],
    ]
    resumen_table = Table(resumen_rows, colWidths=[120 * mm, 50 * mm])
    resumen_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#d1d5db')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story += [resumen_table, Spacer(1, 8)]

    if empleado_asegurado and total_provisiones > 0:
        story += [Paragraph('Provisiones empresa', heading)]
        provisiones_rows = [
            ['Concepto', 'Valor'],
            ['Aporte patronal IESS', money_text(rol.aporte_patronal)],
            ['Décimo tercero', money_text(rol.decimo_tercero)],
            ['Décimo cuarto', money_text(rol.decimo_cuarto)],
            ['Fondos de reserva', money_text(rol.fondos_reserva)],
            ['Vacaciones', money_text(rol.vacaciones)],
        ]
        provisiones_table = Table(provisiones_rows, colWidths=[120 * mm, 50 * mm])
        provisiones_table.setStyle(_table_style(colors.HexColor('#ffedd5')))
        story += [provisiones_table, Spacer(1, 8)]

    try:
        pago_nomina = rol.pago_nomina
    except PagoRol.DoesNotExist:
        pago_nomina = None
    if pago_nomina:
        story += [Paragraph(f'Pago registrado: {pago_nomina.fecha_pago}', small)]

    if rol.notas:
        story += [Spacer(1, 6), Paragraph('<b>Notas</b>', heading), Paragraph(rol.notas, small)]

    story += [Spacer(1, 16), Paragraph('Recibí conforme', right), Spacer(1, 24)]
    firma_table = Table([['', '']], colWidths=[80 * mm, 80 * mm])
    firma_table.setStyle(TableStyle([
        ('LINEABOVE', (1, 0), (1, 0), 0.5, colors.HexColor('#111827')),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
    ]))
    story.append(firma_table)

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
