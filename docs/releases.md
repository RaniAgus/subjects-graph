# Releases conjuntos

CI (`ci.yml`) verifica pushes a main y PRs: tests, tipos y builds de ambas
bibliotecas. No publica. `publish.yml` solo responde a tags
`v<SemVer>` completos; rechaza los inválidos antes de modificar manifests.
Los tags sin `v` y los antiguos `angular-v*` no ejecutan releases.

`v0.2.0` publica ambos paquetes como `0.2.0` en `latest`;
`v0.2.0-alpha.1` publica ambos como `0.2.0-alpha.1` en `next`, sin commit.
La metadata de build SemVer se valida y se elimina de la versión npm.
El peer del core del adaptador queda en `^<versión>` y los enlaces `workspace:*`
se conservan en las fuentes. Solo se empaquetan los dos paquetes públicos.
Se verifican ambos tarballs antes de publicar core y luego Angular.

En npm, ambos paquetes deben configurar Trusted Publishing con GitHub Actions,
owner `RaniAgus`, repositorio `subjects-graph`, workflow `publish.yml`, sin
Environment. No se usan NPM_TOKEN ni GPG. La configuración externa corresponde
al propietario. GitHub Actions necesita permiso de push normal a main; las
reglas de protección deben permitir al bot crear el commit de release.

Los releases se serializan sin cancelar publicaciones en curso. Un reintento
omite una versión existente solamente cuando su `gitHead` coincide con el commit
del tag; un error de red o una discrepancia detiene el release. Si Angular falla
tras publicar core, volver a ejecutar el job completa Angular sin republicar core.
Ningún fallo de publicación genera el commit.

Después de ambas publicaciones, una versión estable actualiza los manifests,
el peer y las referencias propias de documentación y ejemplos CDN en el checkout
actual del tag. Elimina el gitHead temporal usado para publicar. Los enlaces
workspace hacen que estos cambios no requieran modificar el lockfile.
Se crea `chore: release v<versión>` y se ejecuta `git push origin HEAD:main`,
incluyendo todos los commits del tag pendientes en main. No cambia de rama,
no hace merge ni force push. Si main tiene commits divergentes, Git rechaza el
push y hay que integrar esos cambios antes de reintentar. Los prereleases no
crean commits ni hacen push.

Pages mantiene su workflow separado y despliega public/ directamente.
