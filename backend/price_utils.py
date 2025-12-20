"""
Robust price normalization and formatting utilities for backend
Following best practices for handling international price formats
"""

import re
from typing import Union, Optional, Dict, Any


def strip_non_numeric(price_str: str) -> str:
    """Step 1: Strip all non-numeric characters except decimal separators"""
    if not price_str or not isinstance(price_str, str):
        return '0'
    
    # Remove currency symbols, spaces, letters, but keep dots and commas
    return re.sub(r'[^\d.,]', '', price_str)


def detect_locale_format(clean_price: str) -> str:
    """Step 2: Detect locale format based on separator patterns"""
    if not clean_price:
        return 'UNKNOWN'
    
    dot_index = clean_price.rfind('.')
    comma_index = clean_price.rfind(',')
    
    # If both separators exist, the last one is usually decimal
    if dot_index > -1 and comma_index > -1:
        return 'US' if dot_index > comma_index else 'EU'
    
    # If only one separator exists
    if dot_index > -1:
        after_dot = clean_price[dot_index + 1:]
        # If 3+ digits after dot, it's likely thousands separator (EU style)
        # If 1-2 digits, it's likely decimal separator (US style)
        return 'EU' if len(after_dot) > 2 else 'US'
    
    if comma_index > -1:
        after_comma = clean_price[comma_index + 1:]
        # If 3+ digits after comma, it's likely thousands separator (US style)
        # If 1-2 digits, it's likely decimal separator (EU style)
        return 'US' if len(after_comma) > 2 else 'EU'
    
    return 'UNKNOWN'


def normalize_to_standard(clean_price: str, locale: str) -> str:
    """Step 3: Normalize to standard format (decimal point, no thousands)"""
    if not clean_price:
        return '0'
    
    if locale == 'US':
        # US: 1,234.56 -> 1234.56
        return clean_price.replace(',', '')
    
    elif locale == 'EU':
        # EU: 1.234,56 -> 1234.56
        last_comma_index = clean_price.rfind(',')
        if last_comma_index > -1:
            before_comma = clean_price[:last_comma_index].replace('.', '')
            after_comma = clean_price[last_comma_index + 1:]
            return f"{before_comma}.{after_comma}"
        # No comma, just remove dots used as thousands separators
        return clean_price.replace('.', '')
    
    else:  # UNKNOWN
        # Best effort: assume single separator is decimal
        dot_index = clean_price.rfind('.')
        comma_index = clean_price.rfind(',')
        
        if dot_index > comma_index and dot_index > -1:
            return clean_price.replace(',', '')
        elif comma_index > -1:
            before_comma = clean_price[:comma_index].replace('.', '')
            after_comma = clean_price[comma_index + 1:]
            return f"{before_comma}.{after_comma}"
        
        return clean_price.replace(',', '').replace('.', '')


def to_numeric(normalized_str: str) -> float:
    """Step 4: Convert to safe numeric type"""
    if not normalized_str:
        return 0.0
    
    try:
        num = float(normalized_str)
        return num if not (num != num) else 0.0  # Check for NaN
    except (ValueError, TypeError):
        return 0.0


def extract_currency(original_str: str) -> Optional[str]:
    """Extract currency from original price string"""
    if not original_str:
        return None
    
    currency_patterns = [
        (r'USD', 'USD'),
        (r'EUR?', 'EUR'),
        (r'IQD', 'IQD'),
        (r'د\.ع', 'IQD'),
        (r'\$', 'USD'),
        (r'€', 'EUR'),
        (r'£', 'GBP'),
        (r'¥', 'JPY')
    ]
    
    for pattern, currency in currency_patterns:
        if re.search(pattern, original_str, re.IGNORECASE):
            return currency
    
    return None


def parse_price(price_input: Union[str, int, float, None]) -> Dict[str, Any]:
    """
    Main price parsing function
    Converts any price string to normalized numeric value
    """
    # Handle numeric input
    if isinstance(price_input, (int, float)):
        numeric_value = float(price_input) if not (price_input != price_input) else 0.0
        return {
            'numeric_value': numeric_value,
            'raw_value': str(price_input),
            'detected_locale': 'UNKNOWN',
            'currency': None
        }
    
    # Handle null/None
    if not price_input:
        return {
            'numeric_value': 0.0,
            'raw_value': '0',
            'detected_locale': 'UNKNOWN',
            'currency': None
        }
    
    raw_value = str(price_input)
    
    # Step 1: Strip non-numeric
    cleaned = strip_non_numeric(raw_value)
    
    # Step 2: Detect locale
    locale = detect_locale_format(cleaned)
    
    # Step 3: Normalize
    normalized = normalize_to_standard(cleaned, locale)
    
    # Step 4: Convert to numeric
    numeric_value = to_numeric(normalized)
    
    # Extract currency
    currency = extract_currency(raw_value)
    
    return {
        'numeric_value': numeric_value,
        'raw_value': raw_value,
        'detected_locale': locale,
        'currency': currency
    }


def calculate_discount(original_price: float, sale_price: float) -> int:
    """Calculate discount percentage between two prices"""
    if not original_price or not sale_price or original_price <= sale_price:
        return 0
    
    return round(((original_price - sale_price) / original_price) * 100)


def calculate_savings(original_price: float, sale_price: float) -> float:
    """Calculate savings amount"""
    if not original_price or not sale_price or original_price <= sale_price:
        return 0.0
    
    return original_price - sale_price