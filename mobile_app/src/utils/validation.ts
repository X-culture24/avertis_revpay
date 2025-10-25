export class ValidationService {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone: string): boolean {
    // Kenyan phone number validation
    const phoneRegex = /^(\+254|0)[17]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  static validateKRAPin(pin: string): boolean {
    // KRA PIN format: Letter followed by 9 digits and letter (e.g., P051234567M)
    const kraRegex = /^[A-Z]\d{9}[A-Z]$/;
    return kraRegex.test(pin.toUpperCase());
  }

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateInvoiceNumber(invoiceNumber: string): boolean {
    // Basic invoice number validation - alphanumeric, min 3 chars
    const invoiceRegex = /^[A-Za-z0-9-_]{3,}$/;
    return invoiceRegex.test(invoiceNumber);
  }

  static validateAmount(amount: number): boolean {
    return amount > 0 && Number.isFinite(amount);
  }

  static validateTaxRate(taxRate: number): boolean {
    return taxRate >= 0 && taxRate <= 100 && Number.isFinite(taxRate);
  }

  static validateQuantity(quantity: number): boolean {
    return quantity > 0 && Number.isInteger(quantity);
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  static formatPhone(phone: string): string {
    // Format Kenyan phone numbers
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.length === 9) {
      return `+254${cleaned}`;
    }
    
    return phone;
  }

  static formatKRAPin(pin: string): string {
    return pin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}
