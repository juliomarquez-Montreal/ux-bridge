"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/cropImage";
import PillButton from "@/components/PillButton";

interface Props {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

// Modal de recorte de foto de perfil (circular), usado antes do upload.
export default function CropModal({ imageSrc, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-luminous-surface-container p-6">
        <h2 className="mb-4 font-sora text-lg font-semibold">Ajustar foto</h2>

        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black/40">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-4 w-full accent-luminous-primary"
          aria-label="Zoom"
        />

        <div className="mt-6 flex justify-end gap-3">
          <PillButton type="button" variant="inactive" onClick={onCancel} disabled={processing}>
            Cancelar
          </PillButton>
          <PillButton type="button" onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing ? "Processando..." : "Confirmar"}
          </PillButton>
        </div>
      </div>
    </div>
  );
}
