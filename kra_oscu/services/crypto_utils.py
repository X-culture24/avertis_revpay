"""
Cryptographic utilities for KRA eTIMS OSCU integration.
Handles RSA key generation, digital signing, and CMC key encryption.
"""

import base64
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from django.conf import settings

logger = logging.getLogger(__name__)


class KRACryptoManager:
    """Manages cryptographic operations for KRA eTIMS integration."""
    
    def __init__(self):
        self.encryption_key = self._get_encryption_key()
        self.fernet = Fernet(self.encryption_key)
    
    def _get_encryption_key(self):
        """Get or generate Fernet encryption key for CMC keys."""
        key = getattr(settings, 'ENCRYPTION_KEY', None)
        if key:
            # Key from settings is base64 encoded string, return as string for Fernet
            return key
        
        # Generate new key if not configured
        new_key = Fernet.generate_key()
        logger.warning(f"Generated new encryption key. Add to settings: ENCRYPTION_KEY={new_key.decode()}")
        return new_key
    
    def generate_rsa_keypair(self, key_size: int = 2048) -> Tuple[bytes, bytes]:
        """
        Generate RSA key pair for taxpayer digital signing.
        Returns (private_key_pem, public_key_pem)
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=key_size,
        )
        
        # Serialize private key
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        # Serialize public key
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return private_pem, public_pem
    
    def load_private_key(self, private_key_pem: bytes, password: Optional[bytes] = None):
        """Load RSA private key from PEM format."""
        return serialization.load_pem_private_key(
            private_key_pem,
            password=password,
        )
    
    def sign_payload(self, payload: dict, private_key_pem: bytes, cmc_key: str) -> str:
        """
        Generate digital signature for KRA API payload.
        
        Args:
            payload: JSON payload to sign
            private_key_pem: RSA private key in PEM format
            cmc_key: Device CMC key
            
        Returns:
            Base64 encoded signature
        """
        try:
            # Load private key
            private_key = self.load_private_key(private_key_pem)
            
            # Create canonical JSON string
            payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
            
            # Create signature data: payload + CMC key + timestamp
            timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            signature_data = f"{payload_str}{cmc_key}{timestamp}"
            
            # Sign the data using PSS padding
            signature = private_key.sign(
                signature_data.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            return base64.b64encode(signature).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to sign payload: {e}")
            raise
    
    def verify_signature(self, payload: dict, signature_b64: str, public_key_pem: bytes, cmc_key: str) -> bool:
        """
        Verify digital signature of KRA API payload.
        
        Args:
            payload: JSON payload that was signed
            signature_b64: Base64 encoded signature
            public_key_pem: RSA public key in PEM format
            cmc_key: Device CMC key
            
        Returns:
            True if signature is valid
        """
        try:
            # Load public key
            public_key = serialization.load_pem_public_key(public_key_pem)
            
            # Recreate signature data
            payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
            timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            signature_data = f"{payload_str}{cmc_key}{timestamp}"
            
            # Decode signature
            signature = base64.b64decode(signature_b64)
            
            # Verify signature
            public_key.verify(
                signature,
                signature_data.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False
    
    def encrypt_cmc_key(self, cmc_key: str) -> str:
        """Encrypt CMC key for secure storage."""
        encrypted = self.fernet.encrypt(cmc_key.encode())
        return base64.b64encode(encrypted).decode()
    
    def decrypt_cmc_key(self, encrypted_cmc_key: str) -> str:
        """Decrypt CMC key from storage."""
        encrypted_bytes = base64.b64decode(encrypted_cmc_key)
        decrypted = self.fernet.decrypt(encrypted_bytes)
        return decrypted.decode()
    
    def save_keypair_to_files(self, private_key_pem: bytes, public_key_pem: bytes, 
                             device_serial: str, keys_dir: str = "keys") -> Tuple[Path, Path]:
        """
        Save RSA key pair to secure files.
        
        Args:
            private_key_pem: Private key in PEM format
            public_key_pem: Public key in PEM format
            device_serial: Device serial number for filename
            keys_dir: Directory to store keys
            
        Returns:
            (private_key_path, public_key_path)
        """
        keys_path = Path(keys_dir)
        keys_path.mkdir(exist_ok=True, mode=0o700)  # Secure directory permissions
        
        # Save private key
        private_key_path = keys_path / f"{device_serial}_private.pem"
        with open(private_key_path, 'wb') as f:
            f.write(private_key_pem)
        private_key_path.chmod(0o600)  # Read/write for owner only
        
        # Save public key
        public_key_path = keys_path / f"{device_serial}_public.pem"
        with open(public_key_path, 'wb') as f:
            f.write(public_key_pem)
        public_key_path.chmod(0o644)  # Read for all, write for owner
        
        logger.info(f"Saved key pair for device {device_serial}")
        return private_key_path, public_key_path
    
    def load_keypair_from_files(self, device_serial: str, keys_dir: str = "keys") -> Tuple[bytes, bytes]:
        """
        Load RSA key pair from files.
        
        Args:
            device_serial: Device serial number
            keys_dir: Directory containing keys
            
        Returns:
            (private_key_pem, public_key_pem)
        """
        keys_path = Path(keys_dir)
        
        private_key_path = keys_path / f"{device_serial}_private.pem"
        public_key_path = keys_path / f"{device_serial}_public.pem"
        
        if not private_key_path.exists() or not public_key_path.exists():
            raise FileNotFoundError(f"Key files not found for device {device_serial}")
        
        with open(private_key_path, 'rb') as f:
            private_key_pem = f.read()
        
        with open(public_key_path, 'rb') as f:
            public_key_pem = f.read()
        
        return private_key_pem, public_key_pem


# Global instance - removed to avoid initialization during import
