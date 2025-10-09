"""
URL configuration for etims_integration project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    """Health check endpoint"""
    return JsonResponse({'status': 'healthy', 'service': 'eTIMS Integration API'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('kra_oscu.urls')),
    path('health/', health_check, name='health_check'),
]
