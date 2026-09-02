'use client';

export default function AbstractBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-black overflow-hidden">
      {/* Fondo base sólido */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#15121a] via-[#0D0D0D] to-[#1e1a22]" />
      
      {/* Blob 1 - Violeta */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#9457DF] rounded-full mix-blend-screen opacity-20 blur-3xl" />
      
      {/* Blob 2 - Gris */}
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#3c3740] rounded-full mix-blend-screen opacity-15 blur-3xl" />
      
      {/* Pixel grid overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(217, 185, 255, 0.1) 0.5px, transparent 0.5px)',
          backgroundSize: '8px 8px',
        }}
      />
    </div>
  );
}