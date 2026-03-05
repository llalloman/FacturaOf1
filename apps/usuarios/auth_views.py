from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Agregar información del usuario
        data['user'] = {
            'id': self.user.id,
            'username': self.user.email,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'rol': self.user.rol,
            'empresa_id': self.user.empresa_id if hasattr(self.user, 'empresa') else None,
        }
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Obtener información del usuario actual"""
    user = request.user
    return Response({
        'id': user.id,
        'username': user.email,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'rol': user.rol,
        'empresa_id': user.empresa_id if hasattr(user, 'empresa') else None,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout (invalida el token en el cliente)"""
    return Response({'detail': 'Logout exitoso'}, status=status.HTTP_200_OK)
