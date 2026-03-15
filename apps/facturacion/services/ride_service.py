"""
Generación del RIDE (Representación Impresa del Documento Electrónico)
según el formato estándar del SRI Ecuador.
"""
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, Image,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def generar_ride_pdf(factura) -> bytes:
    """
    Genera el RIDE en PDF para una factura autorizada.
    Retorna los bytes del archivo PDF.
    """
    comp     = factura.comprobante
    cliente  = factura.cliente
    empresa  = comp.empresa

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    normal   = styles['Normal']
    tiny     = ParagraphStyle('tiny', parent=normal, fontSize=7)
    small    = ParagraphStyle('small', parent=normal, fontSize=8)
    bold_sm  = ParagraphStyle('bold_sm', parent=normal, fontSize=8, fontName='Helvetica-Bold')
    centered = ParagraphStyle('centered', parent=normal, alignment=TA_CENTER, fontSize=8)
    title_st = ParagraphStyle('title', parent=normal, fontSize=10, fontName='Helvetica-Bold', alignment=TA_CENTER)
    right_st = ParagraphStyle('right', parent=normal, fontSize=8, alignment=TA_RIGHT)

    story = []

    # ── ENCABEZADO ────────────────────────────────────────────────────────────
    # Columna izquierda: datos de empresa | Columna derecha: datos del comprobante
    razon   = empresa.razon_social or ''
    nombre_com = empresa.nombre_comercial or razon
    ruc     = empresa.ruc or ''
    dir_mat = empresa.direccion_matriz or ''
    telefono_emp = getattr(empresa, 'telefono', '') or ''

    num_doc  = comp.numero_comprobante
    num_aut  = comp.numero_autorizacion or '(pendiente)'
    fecha_aut = comp.fecha_autorizacion.strftime('%d/%m/%Y %H:%M:%S') if comp.fecha_autorizacion else ''
    clave_acc = comp.clave_acceso or ''
    ambiente_txt = 'PRODUCCIÓN' if comp.empresa.ambiente == '2' else 'PRUEBAS'

    left_data = []

    # Logo (desde BD primero para que funcione en Railway, luego filesystem)
    logo_bytes = None
    if empresa.logo_data:
        logo_bytes = bytes(empresa.logo_data)
    elif empresa.logo:
        try:
            with empresa.logo.open('rb') as f:
                logo_bytes = f.read()
        except Exception:
            logo_bytes = None

    if logo_bytes:
        try:
            logo_io = BytesIO(logo_bytes)
            logo_img = Image(logo_io, width=55 * mm, height=25 * mm, kind='proportional')
            logo_img.hAlign = 'CENTER'
            left_data.append([logo_img])
        except Exception:
            pass

    left_data += [
        [Paragraph(f'<b>{nombre_com}</b>', title_st)],
        [Paragraph(razon, centered)],
        [Paragraph(f'Dirección Matriz: {dir_mat}', centered)],
        [Paragraph(f'RUC: {ruc}', centered)],
        [Paragraph(f'Obligado Contabilidad: {"SI" if empresa.obligado_contabilidad else "NO"}', centered)],
        [Paragraph(f'Ambiente: {ambiente_txt}', centered)],
    ]
    if telefono_emp:
        left_data.append([Paragraph(f'Teléfono: {telefono_emp}', centered)])

    right_data = [
        [Paragraph('<b>FACTURA</b>', title_st)],
        [Paragraph(f'No. {num_doc}', centered)],
        [Paragraph(f'<b>NÚMERO DE AUTORIZACIÓN</b>', bold_sm)],
        [Paragraph(num_aut, ParagraphStyle('aut', parent=normal, fontSize=7, alignment=TA_CENTER, wordWrap='CJK'))],
        [Paragraph(f'<b>Fecha y hora de autorización:</b>', bold_sm)],
        [Paragraph(fecha_aut, centered)],
    ]

    header_table = Table(
        [[
            Table(left_data,  colWidths=['100%'], style=[
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]),
            Table(right_data, colWidths=['100%'], style=[
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]),
        ]],
        colWidths=['55%', '45%'],
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOX', (0, 0), (0, 0), 0.5, colors.black),
    ]))
    story.append(header_table)

    # Clave de acceso (texto completo, tamaño muy pequeño)
    story.append(Spacer(1, 2 * mm))
    clave_table = Table(
        [[Paragraph('<b>CLAVE DE ACCESO</b>', bold_sm),
          Paragraph(clave_acc, ParagraphStyle('clave', parent=normal, fontSize=7, wordWrap='CJK'))]],
        colWidths=['28%', '72%'],
    )
    clave_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(clave_table)

    # ── DATOS DEL COMPRADOR ───────────────────────────────────────────────────
    story.append(Spacer(1, 4 * mm))
    fecha_emision = comp.fecha_emision.strftime('%d/%m/%Y')
    buyer_data = [
        [Paragraph('<b>Razón Social / Nombres:</b>', bold_sm),
         Paragraph(cliente.razon_social, small),
         Paragraph('<b>Fecha Emisión:</b>', bold_sm),
         Paragraph(fecha_emision, small)],
        [Paragraph('<b>Identificación:</b>', bold_sm),
         Paragraph(cliente.identificacion, small),
         Paragraph('<b>Guía Remisión:</b>', bold_sm),
         Paragraph('', small)],
    ]
    if cliente.direccion:
        buyer_data.append([
            Paragraph('<b>Dirección:</b>', bold_sm),
            Paragraph(cliente.direccion, small),
            '', '',
        ])
    buyer_table = Table(buyer_data, colWidths=['22%', '35%', '20%', '23%'])
    buyer_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('SPAN', (1, len(buyer_data)-1), (3, len(buyer_data)-1)) if cliente.direccion else ('SPAN', (0, 0), (0, 0)),
    ]))
    story.append(buyer_table)

    # ── DETALLES ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 4 * mm))
    det_header = [
        Paragraph('<b>Cód. Principal</b>', centered),
        Paragraph('<b>Descripción</b>', centered),
        Paragraph('<b>Cantidad</b>', centered),
        Paragraph('<b>P. Unitario</b>', centered),
        Paragraph('<b>Descuento</b>', centered),
        Paragraph('<b>P. Total</b>', centered),
    ]
    det_rows = [det_header]
    for d in factura.detalles.all():
        det_rows.append([
            Paragraph(d.codigo_principal, small),
            Paragraph(d.descripcion, small),
            Paragraph(f"{d.cantidad:.2f}", right_st),
            Paragraph(f"${d.precio_unitario:.4f}", right_st),
            Paragraph(f"${d.descuento:.2f}", right_st),
            Paragraph(f"${d.precio_total_sin_impuesto:.2f}", right_st),
        ])

    det_table = Table(
        det_rows,
        colWidths=['15%', '37%', '10%', '14%', '11%', '13%'],
        repeatRows=1,
    )
    det_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D9D9D9')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(det_table)

    # ── TOTALES ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 4 * mm))

    info_adic = factura.informacion_adicional or {}
    # Campos adicionales + totales lado a lado
    add_rows = []
    for k, v in info_adic.items():
        add_rows.append([Paragraph(f'<b>{k}:</b>', bold_sm), Paragraph(str(v), small)])
    # Pad para alinear con tabla de totales
    while len(add_rows) < 5:
        add_rows.append(['', ''])

    totals_data = [
        [Paragraph('<b>SUBTOTAL 0%</b>', bold_sm),  Paragraph(f"${factura.subtotal_0:.2f}", right_st)],
        [Paragraph('<b>SUBTOTAL 12%</b>', bold_sm), Paragraph(f"${factura.subtotal_12:.2f}", right_st)],
        [Paragraph('<b>SUBTOTAL 15%</b>', bold_sm), Paragraph(f"${factura.subtotal_15:.2f}", right_st)],
        [Paragraph('<b>IVA 12%</b>', bold_sm),      Paragraph(f"${factura.iva_12:.2f}", right_st)],
        [Paragraph('<b>IVA 15%</b>', bold_sm),      Paragraph(f"${factura.iva_15:.2f}", right_st)],
        [Paragraph('<b>DESCUENTO</b>', bold_sm),    Paragraph(f"${factura.total_descuento:.2f}", right_st)],
        [Paragraph('<b>VALOR TOTAL</b>', bold_sm),  Paragraph(f"${factura.total:.2f}", right_st)],
    ]

    n_add = len(add_rows)
    n_tot = len(totals_data)
    max_rows = max(n_add, n_tot)
    while len(add_rows) < max_rows:
        add_rows.append(['', ''])
    while len(totals_data) < max_rows:
        totals_data.append(['', ''])

    combined_rows = [
        [add_rows[i][0], add_rows[i][1], totals_data[i][0], totals_data[i][1]]
        for i in range(max_rows)
    ]
    combined_table = Table(combined_rows, colWidths=['25%', '30%', '30%', '15%'])
    combined_table.setStyle(TableStyle([
        ('BOX', (2, 0), (3, -1), 0.5, colors.black),
        ('INNERGRID', (2, 0), (3, -1), 0.25, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (2, 0), (2, -1), 4),
        # Resaltar total final
        ('BACKGROUND', (2, n_tot - 1), (3, n_tot - 1), colors.HexColor('#D9D9D9')),
        ('FONTNAME', (2, n_tot - 1), (3, n_tot - 1), 'Helvetica-Bold'),
    ]))
    story.append(combined_table)

    # ── FORMA DE PAGO ─────────────────────────────────────────────────────────
    story.append(Spacer(1, 4 * mm))
    FORMA_PAGO_LABELS = {
        '01': 'Sin utilización del sistema financiero',
        '15': 'Compensación de deudas',
        '16': 'Tarjeta de débito',
        '17': 'Dinero electrónico',
        '18': 'Tarjeta prepago',
        '19': 'Tarjeta de crédito',
        '20': 'Otros con utilización del sistema financiero',
        '21': 'Endoso de títulos',
    }
    fp_label = FORMA_PAGO_LABELS.get(factura.forma_pago, factura.forma_pago)
    pago_table = Table(
        [[Paragraph('<b>FORMA DE PAGO</b>', bold_sm),
          Paragraph(fp_label, small),
          Paragraph('<b>TOTAL</b>', bold_sm),
          Paragraph(f"${factura.total:.2f}", right_st)]],
        colWidths=['22%', '45%', '15%', '18%'],
    )
    pago_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(pago_table)

    # ── PIE: observaciones / firma electrónica ────────────────────────────────
    if factura.observaciones:
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(f'<b>Observaciones:</b> {factura.observaciones}', small))

    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.grey))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        'Documento electrónico autorizado por el Servicio de Rentas Internas del Ecuador.',
        ParagraphStyle('footer', parent=normal, fontSize=7, alignment=TA_CENTER, textColor=colors.grey),
    ))

    doc.build(story)
    return buffer.getvalue()
