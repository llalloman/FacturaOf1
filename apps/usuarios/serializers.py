"""
Serializers para el módulo de usuarios
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Usuario


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer personalizado para incluir información adicional en el token"""
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Agregar información adicional del usuario
        data['usuario'] = {
            'id': self.user.id,
            'email': self.user.email,
            'nombre_completo': self.user.get_full_name(),
            'rol': self.user.rol,
            'empresa_id': self.user.empresa_id,
            'es_super_admin': self.user.es_super_admin,
        }
        
        # Verificar que la empresa esté activa (si aplica)
        if self.user.empresa:
            if not self.user.empresa.activa:
                raise serializers.ValidationError(
                    'La empresa asociada a este usuario está inactiva. '
                    'Por favor contacte al administrador.'
                )
            if not self.user.empresa.tiene_suscripcion_activa():
                raise serializers.ValidationError(
                    'La suscripción de la empresa ha vencido. '
                    'Por favor renueve la suscripción para continuar.'
                )
        
        return data


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializer para el modelo Usuario"""
    
    nombre_completo = serializers.CharField(source='get_full_name', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    
    class Meta:
        model = Usuario
        fields = [
            'id', 'email', 'first_name', 'last_name', 'nombre_completo',
            'cedula', 'telefono', 'rol', 'empresa', 'empresa_nombre',
            'is_active', 'fecha_registro', 'ultima_actividad'
        ]
        read_only_fields = ['id', 'fecha_registro', 'ultima_actividad']
    
    def validate_email(self, value):
        """Validar que el email sea único"""
        if self.instance:
            if Usuario.objects.exclude(pk=self.instance.pk).filter(email=value).exists():
                raise serializers.ValidationError("Este email ya está registrado.")
        else:
            if Usuario.objects.filter(email=value).exists():
                raise serializers.ValidationError("Este email ya está registrado.")
        return value


class UsuarioCreateSerializer(UsuarioSerializer):
    """Serializer para crear usuarios con contraseña"""
    
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    class Meta(UsuarioSerializer.Meta):
        fields = UsuarioSerializer.Meta.fields + ['password', 'password_confirm']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Las contraseñas no coinciden.'
            })
        attrs.pop('password_confirm')
        return attrs
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario = Usuario.objects.create_user(password=password, **validated_data)
        return usuario


class CambiarPasswordSerializer(serializers.Serializer):
    """Serializer para cambiar contraseña"""
    
    password_actual = serializers.CharField(write_only=True)
    password_nueva = serializers.CharField(write_only=True, min_length=8)
    password_nueva_confirm = serializers.CharField(write_only=True, min_length=8)
    
    def validate(self, attrs):
        if attrs['password_nueva'] != attrs['password_nueva_confirm']:
            raise serializers.ValidationError({
                'password_nueva_confirm': 'Las contraseñas no coinciden.'
            })
        return attrs
    
    def validate_password_actual(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual es incorrecta.')
        return value
