"""
PDF Generation Service for Invoices
Generates KRA-compliant PDF receipts with QR codes and digital signatures
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors as pdf_colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfgen import canvas
from io import BytesIO
import qrcode
from datetime import datetime
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class InvoicePDFGenerator:
    """Generate PDF receipts for KRA-compliant invoices"""
    
    def __init__(self, invoice):
        self.invoice = invoice
        self.buffer = BytesIO()
        self.width, self.height = A4
        
    def generate_qr_code(self):
        """Generate QR code for invoice verification"""
        if self.invoice.qr_code_data:
            qr_data = self.invoice.qr_code_data
        else:
            # Generate QR code data
            company = self.invoice.device.company if self.invoice.device else None
            qr_data = f"KRA|{company.tin if company else 'N/A'}|{self.invoice.invoice_no}|{self.invoice.total_amount}|{self.invoice.created_at.strftime('%Y%m%d%H%M%S')}"
        
        # Generate QR code image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save to BytesIO
        qr_buffer = BytesIO()
        img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        
        return qr_buffer
    
    def generate(self):
        """Generate complete PDF invoice"""
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        # Container for PDF elements
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=pdf_colors.HexColor('#1a1a1a'),
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=pdf_colors.HexColor('#333333'),
            spaceAfter=6,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            textColor=pdf_colors.HexColor('#666666'),
            spaceAfter=3
        )
        
        # Get company and device info
        company = self.invoice.device.company if self.invoice.device else None
        device = self.invoice.device
        
        # Title
        elements.append(Paragraph("TAX INVOICE / RECEIPT", title_style))
        elements.append(Spacer(1, 10*mm))
        
        # Company Information
        elements.append(Paragraph("SELLER INFORMATION", header_style))
        company_data = [
            ['Business Name:', company.company_name if company else 'N/A'],
            ['KRA PIN (TIN):', company.tin if company else 'N/A'],
            ['Address:', company.business_address if company else 'N/A'],
            ['Phone:', company.contact_phone if company else 'N/A'],
            ['Email:', company.contact_email if company else 'N/A'],
        ]
        
        company_table = Table(company_data, colWidths=[40*mm, 120*mm])
        company_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), pdf_colors.HexColor('#333333')),
            ('TEXTCOLOR', (1, 0), (1, -1), pdf_colors.HexColor('#666666')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(company_table)
        elements.append(Spacer(1, 8*mm))
        
        # Invoice Information
        elements.append(Paragraph("INVOICE DETAILS", header_style))
        invoice_data = [
            ['Invoice Number:', self.invoice.invoice_no],
            ['Receipt Number:', self.invoice.receipt_no or 'Pending KRA Approval'],
            ['Date:', self.invoice.created_at.strftime('%d/%m/%Y %H:%M:%S')],
            ['Status:', self.invoice.status.upper()],
            ['Device Serial:', device.serial_number if device else 'N/A'],
        ]
        
        invoice_table = Table(invoice_data, colWidths=[40*mm, 120*mm])
        invoice_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), pdf_colors.HexColor('#333333')),
            ('TEXTCOLOR', (1, 0), (1, -1), pdf_colors.HexColor('#666666')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(invoice_table)
        elements.append(Spacer(1, 8*mm))
        
        # Customer Information
        if self.invoice.customer_name:
            elements.append(Paragraph("CUSTOMER INFORMATION", header_style))
            customer_data = [
                ['Customer Name:', self.invoice.customer_name],
                ['Customer PIN:', self.invoice.customer_tin or 'N/A'],  # Fixed: customer_tin not customer_pin
            ]
            
            customer_table = Table(customer_data, colWidths=[40*mm, 120*mm])
            customer_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (0, 0), (0, -1), pdf_colors.HexColor('#333333')),
                ('TEXTCOLOR', (1, 0), (1, -1), pdf_colors.HexColor('#666666')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(customer_table)
            elements.append(Spacer(1, 8*mm))
        
        # Items Table
        elements.append(Paragraph("ITEMS", header_style))
        
        items_data = [['#', 'Description', 'Qty', 'Unit Price', 'Tax', 'Total']]
        
        for idx, item in enumerate(self.invoice.items.all(), 1):
            items_data.append([
                str(idx),
                item.item_name,  # Fixed: item_name not description
                str(item.quantity),
                f'KES {item.unit_price:,.2f}',
                f'KES {item.tax_amount:,.2f}',
                f'KES {item.total_price:,.2f}'  # Fixed: total_price not total_amount
            ])
        
        items_table = Table(items_data, colWidths=[10*mm, 60*mm, 20*mm, 30*mm, 25*mm, 30*mm])
        items_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), pdf_colors.HexColor('#4CAF50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), pdf_colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            
            # Data rows
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TEXTCOLOR', (0, 1), (-1, -1), pdf_colors.HexColor('#666666')),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, pdf_colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [pdf_colors.white, pdf_colors.HexColor('#f5f5f5')]),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 8*mm))
        
        # Totals
        # Calculate subtotal (total before tax)
        subtotal = self.invoice.total_amount - self.invoice.tax_amount
        
        totals_data = [
            ['Subtotal:', f'KES {subtotal:,.2f}'],
            ['Tax (VAT 16%):', f'KES {self.invoice.tax_amount:,.2f}'],
            ['TOTAL:', f'KES {self.invoice.total_amount:,.2f}'],
        ]
        
        totals_table = Table(totals_data, colWidths=[130*mm, 45*mm])
        totals_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, 1), 'Helvetica'),
            ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 1), 11),
            ('FONTSIZE', (0, 2), (-1, 2), 14),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('TEXTCOLOR', (0, 0), (-1, 1), pdf_colors.HexColor('#666666')),
            ('TEXTCOLOR', (0, 2), (-1, 2), pdf_colors.HexColor('#1a1a1a')),
            ('LINEABOVE', (0, 2), (-1, 2), 2, pdf_colors.HexColor('#4CAF50')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 2), (-1, 2), 10),
        ]))
        elements.append(totals_table)
        elements.append(Spacer(1, 10*mm))
        
        # QR Code and Verification
        if self.invoice.status in ['confirmed', 'approved'] and self.invoice.receipt_no:
            elements.append(Paragraph("KRA VERIFICATION", header_style))
            
            # Generate QR code
            qr_buffer = self.generate_qr_code()
            qr_image = Image(qr_buffer, width=40*mm, height=40*mm)
            
            signature_preview = self.invoice.receipt_signature[:32] if self.invoice.receipt_signature else 'N/A'
            
            verification_data = [
                [qr_image, Paragraph(
                    f"<b>Receipt Number:</b> {self.invoice.receipt_no}<br/>"
                    f"<b>Verification URL:</b> https://etims.kra.go.ke/verify/{self.invoice.receipt_no}<br/>"
                    f"<b>Digital Signature:</b> {signature_preview}...<br/>"
                    f"<br/><i>Scan QR code to verify this receipt with KRA</i>",
                    normal_style
                )]
            ]
            
            verification_table = Table(verification_data, colWidths=[45*mm, 130*mm])
            verification_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (1, 0), (1, 0), 10),
            ]))
            elements.append(verification_table)
        
        # Footer
        elements.append(Spacer(1, 10*mm))
        footer_text = (
            "<i>This is a computer-generated invoice and is valid without signature. "
            "For any queries, please contact us at the above details.</i><br/>"
            f"<b>Generated by RevPay Connect</b> | Powered by KRA eTIMS | {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"
        )
        elements.append(Paragraph(footer_text, ParagraphStyle(
            'Footer',
            parent=normal_style,
            fontSize=8,
            textColor=pdf_colors.HexColor('#999999'),
            alignment=TA_CENTER
        )))
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF data
        pdf_data = self.buffer.getvalue()
        self.buffer.close()
        
        return pdf_data
    
    @classmethod
    def generate_invoice_pdf(cls, invoice):
        """Class method to generate PDF for an invoice"""
        generator = cls(invoice)
        return generator.generate()
