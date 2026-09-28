# Threadline workshop studio

Frontend-only T-shirt workshop configurator built with Next.js, Fabric.js, Three.js, and React Three Fiber.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Design workflow

The editor keeps independent front/back Fabric canvases. Canvas objects are serialized in browser storage and rendered as transparent UV overlays on the shirt model. The shirt material remains separate from artwork. The 3D preview is for visualization, not a production print file.

## Shirt model

The viewer loads `public/models/02.glb`. The front and back body panels provide separate UV regions; the viewer also includes the model's sleeve meshes and filters out unrelated meshes.
