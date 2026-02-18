#!/usr/bin/env python3
"""
Comprehensive API Route Testing Script
Tests all backend routes to ensure they work correctly
"""
import requests
import json
from datetime import datetime
import sys

# Configuration
BASE_URL = "http://localhost:8000/api/mobile"
TEST_EMAIL = "test@revpay.com"
TEST_PASSWORD = "testpass123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_data = None
        self.company_id = None
        self.device_id = None
        self.invoice_id = None
        self.subscription_id = None
        
    def test_health_check(self):
        """Test health check endpoint"""
        print_info("Testing health check...")
        try:
            response = requests.get(f"{self.base_url}/health/", timeout=5)
            if response.status_code == 200:
                print_success(f"Health check passed: {response.json()}")
                return True
            else:
                print_error(f"Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Health check error: {str(e)}")
            return False
    
    def test_subscription_plans(self):
        """Test getting subscription plans (no auth required)"""
        print_info("Testing subscription plans endpoint...")
        try:
            response = requests.get(f"{self.base_url}/subscription/plans/")
            if response.status_code == 200:
                data = response.json()
                print_success(f"Got {len(data.get('data', []))} subscription plans")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Failed to get plans: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Subscription plans error: {str(e)}")
            return False
    
    def test_register_business(self):
        """Test complete business registration"""
        print_info("Testing business registration...")
        
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        data = {
            "full_name": "Test User",
            "email": f"test{timestamp}@revpay.com",
            "password": "testpass123",
            "company_name": f"Test Company {timestamp}",
            "tin": f"123456{timestamp[-5:]}",
            "contact_phone": "+254712345678",
            "business_address": "123 Test Street, Nairobi",
            "device_serial_number": f"DEV{timestamp}",
            "device_type": "oscu",
            "plan_id": "free-plan"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/register-business/",
                json=data
            )
            
            if response.status_code == 201:
                result = response.json()
                print_success("Business registered successfully")
                print(json.dumps(result, indent=2))
                self.company_id = result.get('company', {}).get('id')
                self.device_id = result.get('device', {}).get('id')
                return True
            else:
                print_error(f"Registration failed: {response.status_code}")
                print(response.text)
                return False
        except Exception as e:
            print_error(f"Registration error: {str(e)}")
            return False
    
    def test_login(self, email=None, password=None):
        """Test login endpoint"""
        print_info("Testing login...")
        
        credentials = {
            "username": email or TEST_EMAIL,
            "password": password or TEST_PASSWORD
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/login/",
                json=credentials
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('tokens', {}).get('access')
                self.user_data = data.get('user')
                print_success(f"Login successful for {self.user_data.get('email')}")
                return True
            else:
                print_error(f"Login failed: {response.status_code}")
                print(response.text)
                return False
        except Exception as e:
            print_error(f"Login error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get authorization headers"""
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        print_info("Testing dashboard stats...")
        try:
            response = requests.get(
                f"{self.base_url}/dashboard/stats/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Dashboard stats retrieved")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Dashboard stats failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Dashboard stats error: {str(e)}")
            return False
    
    def test_company_profile(self):
        """Test company profile endpoint"""
        print_info("Testing company profile...")
        try:
            response = requests.get(
                f"{self.base_url}/company/profile/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Company profile retrieved")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Company profile failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Company profile error: {str(e)}")
            return False
    
    def test_devices_list(self):
        """Test devices list endpoint"""
        print_info("Testing devices list...")
        try:
            response = requests.get(
                f"{self.base_url}/devices/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                devices = data.get('data', [])
                print_success(f"Got {len(devices)} devices")
                if devices:
                    self.device_id = devices[0].get('id')
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Devices list failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Devices list error: {str(e)}")
            return False
    
    def test_current_subscription(self):
        """Test current subscription endpoint"""
        print_info("Testing current subscription...")
        try:
            response = requests.get(
                f"{self.base_url}/subscription/current/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Current subscription retrieved")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Current subscription failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Current subscription error: {str(e)}")
            return False
    
    def test_check_subscription_limits(self):
        """Test subscription limits check"""
        print_info("Testing subscription limits check...")
        try:
            response = requests.post(
                f"{self.base_url}/subscription/check-limits/",
                json={"action": "create_invoice"},
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Subscription limits checked")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Subscription limits check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Subscription limits error: {str(e)}")
            return False
    
    def test_create_invoice(self):
        """Test invoice creation"""
        print_info("Testing invoice creation...")
        
        invoice_data = {
            "tin": "12345678901",
            "customer_name": "Test Customer",
            "customer_tin": "",
            "total_amount": 1160,
            "tax_amount": 160,
            "currency": "KES",
            "payment_type": "CASH",
            "receipt_type": "normal",
            "transaction_type": "sale",
            "transaction_date": datetime.now().isoformat(),
            "device_serial_number": "REAL001",
            "items": [
                {
                    "item_code": "ITEM001",
                    "item_name": "Test Product",
                    "quantity": 10,
                    "unit_price": 100,
                    "tax_type": "B",
                    "tax_rate": 16,
                    "unit_of_measure": "EA"
                }
            ]
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/invoices/",
                json=invoice_data,
                headers=self.get_headers()
            )
            
            if response.status_code in [200, 201, 207]:
                data = response.json()
                print_success("Invoice created successfully")
                print(json.dumps(data, indent=2))
                if 'data' in data and 'id' in data['data']:
                    self.invoice_id = data['data']['id']
                return True
            else:
                print_error(f"Invoice creation failed: {response.status_code}")
                print(response.text)
                return False
        except Exception as e:
            print_error(f"Invoice creation error: {str(e)}")
            return False
    
    def test_invoices_list(self):
        """Test invoices list endpoint"""
        print_info("Testing invoices list...")
        try:
            response = requests.get(
                f"{self.base_url}/invoices/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                invoices = data.get('results', [])
                print_success(f"Got {len(invoices)} invoices")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Invoices list failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Invoices list error: {str(e)}")
            return False
    
    def test_sync_device(self):
        """Test device sync"""
        if not self.device_id:
            print_warning("No device ID available, skipping sync test")
            return False
        
        print_info(f"Testing device sync for device {self.device_id}...")
        try:
            response = requests.post(
                f"{self.base_url}/devices/{self.device_id}/sync/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Device synced successfully")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"Device sync failed: {response.status_code}")
                print(response.text)
                return False
        except Exception as e:
            print_error(f"Device sync error: {str(e)}")
            return False
    
    def test_vscu_status(self):
        """Test VSCU status endpoint"""
        print_info("Testing VSCU status...")
        try:
            response = requests.get(
                f"{self.base_url}/vscu/status/",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("VSCU status retrieved")
                print(json.dumps(data, indent=2))
                return True
            else:
                print_error(f"VSCU status failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"VSCU status error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "="*60)
        print("REVPAY CONNECT API ROUTE TESTING")
        print("="*60 + "\n")
        
        results = {}
        
        # Test 1: Health Check (no auth)
        results['health_check'] = self.test_health_check()
        
        # Test 2: Subscription Plans (no auth)
        results['subscription_plans'] = self.test_subscription_plans()
        
        # Test 3: Try to login with existing user
        print_info("\nAttempting login with existing user...")
        if self.test_login():
            # Authenticated tests
            results['dashboard_stats'] = self.test_dashboard_stats()
            results['company_profile'] = self.test_company_profile()
            results['devices_list'] = self.test_devices_list()
            results['current_subscription'] = self.test_current_subscription()
            results['check_limits'] = self.test_check_subscription_limits()
            results['invoices_list'] = self.test_invoices_list()
            results['create_invoice'] = self.test_create_invoice()
            results['sync_device'] = self.test_sync_device()
            results['vscu_status'] = self.test_vscu_status()
        else:
            print_warning("Login failed, skipping authenticated tests")
        
        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            status = "PASS" if result else "FAIL"
            color = Colors.GREEN if result else Colors.RED
            print(f"{color}{status}{Colors.END} - {test_name}")
        
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print_success("\n🎉 All tests passed!")
            return 0
        else:
            print_error(f"\n❌ {total - passed} test(s) failed")
            return 1

if __name__ == "__main__":
    tester = APITester()
    sys.exit(tester.run_all_tests())
