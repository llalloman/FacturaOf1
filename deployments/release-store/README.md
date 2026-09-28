# Frontend release store

Este directorio solo documenta el contrato local del almacén de releases; los
artefactos compilados no se versionan en Git. En CI o en el host de despliegue
se debe usar un volumen, bucket u otra ubicación durable aprobada.

Flujo mínimo:

```powershell
.\deployments\retain-frontend-artifacts.ps1 `
  -SourceRoot <artifacts> `
  -DestinationRoot <release-store> `
  -ReleaseId <release-id>
.\deployments\verify-frontend-release.ps1 `
  -ReleasePath <release-store>\<release-id>
```

La ubicación real debe conservar al menos el release actual y el anterior,
con permisos restringidos y una política de retención definida por operación.
