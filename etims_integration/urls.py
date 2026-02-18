"""
URL configuration for etims_integration project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.shortcuts import redirect

def health_check(request):
    """Health check endpoint"""
    return JsonResponse({'status': 'healthy', 'service': 'eTIMS Integration API'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/mobile/', include('kra_oscu.api_urls')),
    path('api/mobile/', include('kra_oscu.urls')),  # Include subscription & notification endpoints
    path('health/', health_check, name='health_check'),
    path('', lambda request: JsonResponse({'message': 'Revpay Connect Mobile API', 'version': '1.0'})),
]
