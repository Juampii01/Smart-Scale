# -*- coding: utf-8 -*-
"""Genera el PDF de release notes de Smart Scale 3.0."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle,
    ListFlowable, ListItem,
)

OUT = "Smart-Scale-3.0-Release-Notes.pdf"

# ── Paleta ───────────────────────────────────────────────────────────────────
YELLOW   = colors.HexColor("#FFDE21")
INK      = colors.HexColor("#1A1A1E")
GREY     = colors.HexColor("#5A5A5E")
GREY_L   = colors.HexColor("#9A9A9E")
LINE     = colors.HexColor("#E6E6E8")
SOFT     = colors.HexColor("#FBF7DC")

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, parent=styles["Normal"], **kw)

st_title    = S("t",  fontName="Helvetica-Bold", fontSize=30, leading=34, textColor=INK)
st_sub      = S("s",  fontName="Helvetica",      fontSize=11, leading=15, textColor=GREY)
st_h2       = S("h2", fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=6, spaceAfter=2)
st_h2note   = S("h2n",fontName="Helvetica-Bold", fontSize=9,  leading=12, textColor=GREY_L)
st_lead     = S("ld", fontName="Helvetica",      fontSize=10.5, leading=15, textColor=GREY)
st_body     = S("b",  fontName="Helvetica",      fontSize=10, leading=14.5, textColor=INK)
st_bullet   = S("bl", fontName="Helvetica",      fontSize=9.7, leading=14, textColor=INK)
st_kicker   = S("k",  fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.HexColor("#B58A00"), spaceAfter=2)
st_small    = S("sm", fontName="Helvetica",      fontSize=8.5, leading=12, textColor=GREY_L)
st_th       = S("th", fontName="Helvetica-Bold", fontSize=9,  leading=12, textColor=INK)
st_td       = S("td", fontName="Helvetica",      fontSize=9,  leading=12, textColor=INK)


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, st_bullet), leftIndent=10, value="•") for t in items],
        bulletType="bullet", bulletColor=YELLOW, bulletFontSize=8,
        leftIndent=8, spaceBefore=2, spaceAfter=8,
    )


def section(story, kicker, title, note, items):
    story.append(Paragraph(kicker, st_kicker))
    row = Table(
        [[Paragraph(title, st_h2), Paragraph(note, st_h2note)]],
        colWidths=[120 * mm, 45 * mm],
    )
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(row)
    story.append(HRFlowable(width="100%", thickness=2, color=YELLOW, spaceBefore=1, spaceAfter=6))
    story.append(bullets(items))


def header_footer(canvas, doc):
    canvas.saveState()
    # franja superior amarilla
    canvas.setFillColor(YELLOW)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    # pie
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY_L)
    canvas.drawString(18 * mm, 12 * mm, "Smart Scale 3.0  ·  Resumen de actualizaciones")
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=20 * mm, bottomMargin=20 * mm,
    title="Smart Scale 3.0 — Release Notes", author="Smart Scale",
)

story = []

# ── Portada / encabezado ─────────────────────────────────────────────────────
brand = Table([[
    Paragraph('<b>Smart</b>', S("bx", fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=INK, alignment=1)),
    Paragraph('<b>Scale</b>', S("bx2", fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=colors.white, alignment=1)),
]], colWidths=[20 * mm, 20 * mm])
brand.setStyle(TableStyle([
    ("BACKGROUND", (1, 0), (1, 0), INK),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2),
]))
story.append(brand)
story.append(Spacer(1, 10))
story.append(Paragraph("Versión 3.0", st_kicker))
story.append(Paragraph("Resumen de actualizaciones", st_title))
story.append(Spacer(1, 4))
story.append(Paragraph("15 de junio de 2026  ·  Portal de analytics + CRM operativo", st_sub))
story.append(Spacer(1, 10))
story.append(Paragraph(
    "La versión 3.0 introduce un sistema de diseño unificado en todo el producto, una nueva "
    "vista de Performance basada en el modelo de 4 etapas, el Context Room para el contexto del "
    "cliente, las secciones de contenido de Instagram y YouTube con persistencia real, la "
    "actualización de la superficie interna (admin) y una corrección importante en el cálculo de "
    "comisiones de los setters.", st_lead))
story.append(Spacer(1, 14))

# ── Secciones ────────────────────────────────────────────────────────────────
section(story, "DISEÑO", "Sistema de diseño unificado", "PR #26 · en producción", [
    "Tokens de color para light y dark, tipografía Geist (display) + Geist Mono para columnas numéricas; títulos sin serif.",
    "Sidebar minimalista estilo Scale20: secciones sin colapsables (solo YouTube, Instagram y Content Tools se expanden), sin líneas divisorias ni botón de colapsar.",
    "Cards normalizadas: borde sutil completo, esquinas de 14px y sin franjas de color decorativas. El amarillo queda reservado para acentos y acciones.",
    "Componente <b>Stat</b> para números héroe (tabular-nums + formateo con Intl.NumberFormat).",
    "Restyle de Reflection, Monday Win, Cha-Ching, Reporte Mensual, Ann AI y GPTs.",
    "Fix del tablero de Tareas (kanban): las tarjetas ya no se solapan ni cortan el título.",
])

section(story, "NUEVO", "Vista Performance (modelo de 4 etapas)", "PR #26 · en producción", [
    "Nueva sección Performance con pestañas <b>Fascinate · Educate · Invite · Transform</b>, cada una con sus métricas y tendencia.",
    "Los datos salen de los reportes mensuales existentes — sin consultas nuevas.",
    "El embudo de <b>Sales</b> ahora vive dentro de la pestaña Invite; los datos de canales (Instagram/YouTube/Email) se integran en Fascinate y Educate.",
])

section(story, "NUEVO", "Context Room", "PR #26 + #27 · en producción", [
    "Reemplaza el viejo perfil por una vista de ancho completo con 7 pestañas, en español: Ubicación y cuenta, Sobre vos, Sobre tu negocio, Los números, Tu cliente, Contenido y audiencia, y Cómo llegaste acá.",
    "Guardado automático del contexto en Supabase (tabla <b>client_context</b>, por cliente).",
    "Mantiene la edición de foto, nombre, email y contraseña.",
])

section(story, "NUEVO", "Contenido: Instagram & YouTube", "PR #26 + #27 · en producción", [
    "Instagram y YouTube como secciones colapsables con sub-items: My Profile/Channel, Competitors, Vault e Ideas.",
    "<b>Ideas</b>: crear, listar y borrar ideas de contenido (formato, hook, notas) — persistido en Supabase.",
    "<b>Vault</b>: guardar reels/videos de referencia con favorito.",
    "<b>Competitors</b>: guardar perfiles/canales de competidores.",
    "Migración SQL aplicada: content_ideas, content_competitors, content_vault, client_context (con RLS por cliente).",
])

section(story, "ESTÉTICA", "Pasada de pulido del portal", "PR #28 · en producción", [
    "Normalización de toda la estética del portal: esquinas a 14px y eliminación de franjas de color, glows y degradados decorativos en todas las vistas.",
    "Correcciones de contraste light/dark (texto de color sin variante oscura).",
])

section(story, "INTERNO", "Estética del admin", "PR #30 · en producción", [
    "Sidebar interno reescrito al mismo estilo minimalista del portal: panel flotante, sin botón de colapsar ni líneas divisorias.",
    "Vistas internas normalizadas a las esquinas de 14px del design system.",
    "Se mantiene el filtrado por rol, el acceso 'Volver al portal' y el indicador INTERNAL.",
])

section(story, "CORRECCIÓN", "Comisiones de setters: New Cash vs Old Cash", "PR #29 · en producción", [
    "Se corrige un error que mezclaba el revenue y el cash de clientes que habían cerrado en meses anteriores.",
    "Ahora un cliente se considera <b>nuevo</b> según su fecha de cierre real (program_start).",
    "Revenue = contrato de los cierres nuevos del mes · New Cash = cuotas de esos cierres · Old Cash = cuotas de clientes de meses anteriores · Comisión = 5% del cash total.",
    "Columnas nuevas en el panel: Nuevos · Cuotas · Revenue · New Cash · Old Cash · Comisión.",
])

section(story, "NUEVO", "Agenda estilo Scale20 + Grabaciones", "PR #31 · en producción", [
    "La Agenda se rediseñó al layout de Scale20: pestañas <b>Próximas</b> y <b>Grabaciones</b> con buscador.",
    "Calcula las fechas reales de cada sesión recurrente (semanal, cada 2 semanas, mensual, etc.) y las agrupa por mes, con las 2 más próximas destacadas arriba.",
    "Cada fila muestra el día grande, la sesión, la hora de Miami + tu hora local, el código y el botón Unirse.",
    "Sistema de grabaciones: un webhook seguro recibe las grabaciones desde Zapier (Zoom → Smart Scale) y las publica solas en la pestaña Grabaciones, con botón Ver y Playbook.",
    "Requiere configuración: correr la migración calendar_recordings, setear RECORDING_WEBHOOK_SECRET en Vercel y agregar el paso de webhook al Zap de Zoom.",
])

# ── Tabla resumen de PRs ─────────────────────────────────────────────────────
story.append(Spacer(1, 4))
story.append(Paragraph("RESUMEN", st_kicker))
story.append(Paragraph("Cambios entregados", st_h2))
story.append(HRFlowable(width="100%", thickness=2, color=YELLOW, spaceBefore=1, spaceAfter=8))

rows = [[Paragraph("PR", st_th), Paragraph("Cambio", st_th), Paragraph("Estado", st_th)]]
data = [
    ("#26", "Sistema de diseño + Performance + Context Room + Contenido", "En producción"),
    ("#27", "Persistencia en Supabase (Ideas / Vault / Competitors / Context)", "En producción"),
    ("#28", "Pasada de estética del portal", "En producción"),
    ("#29", "Fix comisiones de setters (New/Old Cash)", "En producción"),
    ("#30", "Estética de la superficie interna (admin)", "En producción"),
    ("#31", "Agenda estilo Scale20 + sistema de grabaciones", "En producción"),
]
for pr, change, state in data:
    rows.append([Paragraph(pr, st_td), Paragraph(change, st_td), Paragraph(state, st_td)])

tbl = Table(rows, colWidths=[14 * mm, 116 * mm, 35 * mm])
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), SOFT),
    ("LINEBELOW", (0, 0), (-1, 0), 1, YELLOW),
    ("LINEBELOW", (0, 1), (-1, -2), 0.5, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
]))
story.append(tbl)
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Configuración pendiente del usuario (para activar grabaciones): correr la migración "
    "<b>calendar_recordings</b> en Supabase, setear <b>RECORDING_WEBHOOK_SECRET</b> en Vercel y "
    "agregar el paso de webhook al Zap de Zoom. Próxima tanda: sección Claude Skills.", st_small))

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("OK:", OUT)
