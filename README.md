# La Van Map, le site

Site de présentation de l'application : carte dessinée, van qui suit la route, téléphone 3D.
Thèmes clair, sombre et système. Aucun cookie, aucun traceur, aucune ressource externe.

```sh
npm install
npm run dev      # développement, http://localhost:5173
npm run build    # site prêt à publier dans dist/
npm run preview  # vérifier dist/
```

- `index.html`, `src/` : page, styles, carte (`map.js`), téléphone (`phone.js`), thème.
- `public/screens/` : captures de l'app en clair et en sombre.
- `art/build_phone.py` : modèles 3D (Blender). `art/*.blend` : fichiers à ouvrir dans Blender.
- `tools/screens.mjs` : conversion des captures et rendus, lus dans `%TEMP%/claude/shots`.

Sans WebGL ou avec « animations réduites », une version simple s'affiche.
Avec Live Server (VS Code) : `npm run build` une fois (ou `npm run watch`), puis « Go Live »,
qui affiche `dist/`. Ouvrir `index.html` directement ne marche pas.
