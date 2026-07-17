import React from 'react';

interface Field {
  label: string;
  placeholder: string;
  required: boolean;
  style: string;
}

interface TicketPreviewProps {
  name: string;
  description: string;
  embedColor: string;
  fields: Field[];
  channelName?: string;
  isDraft?: boolean;
}

const TicketPreview: React.FC<TicketPreviewProps> = ({
  name,
  description,
  embedColor,
  fields,
  channelName,
  isDraft,
}) => {
  return (
    <div className="rounded-2xl border-[3px] border-black bg-[#313338] p-0 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      {/* Discord-style header */}
      <div className="bg-[#2B2D31] px-4 py-2 flex items-center gap-2 border-b-2 border-black/20">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ED4245]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FEE75C]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#57F287]" />
        </div>
        <span className="text-[11px] text-[#949BA4] ml-2 font-medium">
          {isDraft ? 'ANTEPRIMA EMBED' : channelName || 'Canale Ticket'}
        </span>
      </div>

      {/* Embed Preview */}
      <div className="p-4">
        <div className="flex">
          {/* Color bar (left side of Discord embed) */}
          <div
            className="w-1 rounded-l-md flex-shrink-0 mr-3"
            style={{ backgroundColor: embedColor }}
          />

          <div className="flex-1 min-w-0">
            {/* Embed author */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">B</span>
              </div>
              <span className="text-[12px] text-[#DBDEE1] font-medium">Broski BOT</span>
              <span className="text-[11px] text-[#949BA4]">oggi alle 12:00</span>
            </div>

            {/* Embed title */}
            <h3 className="text-[14px] font-bold text-[#DBDEE1] mb-1">
              🎫 {name || 'Nome Pannello'}
            </h3>

            {/* Embed description */}
            <p className="text-[13px] text-[#B5BAC1] leading-relaxed whitespace-pre-wrap">
              {description || 'Descrizione del pannello ticket...'}
            </p>

            {/* Embed fields preview */}
            {fields.length > 0 && (
              <div className="mt-3 space-y-2">
                {fields.map((field, i) => (
                  <div key={i} className="bg-[#2B2D31] rounded-lg px-3 py-2 border border-[#1E1F22]">
                    <p className="text-[11px] text-[#949BA4] uppercase font-bold">
                      {field.label || `Campo ${i + 1}`}
                      {field.required && <span className="text-[#ED4245] ml-1">*</span>}
                    </p>
                    <p className="text-[12px] text-[#6D6F78] italic mt-0.5">
                      {field.placeholder || (field.style === 'long' ? 'Risposta lunga...' : 'Risposta breve...')}
                    </p>
                    <div className={`mt-1 rounded border border-[#1E1F22] bg-[#383A40] ${
                      field.style === 'long' ? 'h-12' : 'h-6'
                    }`} />
                  </div>
                ))}
              </div>
            )}

            {/* Dropdown preview */}
            <div className="mt-3 bg-[#2B2D31] rounded-lg px-3 py-2 border border-[#1E1F22]">
              <p className="text-[11px] text-[#949BA4] uppercase font-bold mb-1">Seleziona il tipo di ticket</p>
              <div className="flex items-center justify-between bg-[#1E1F22] rounded px-3 py-2">
                <span className="text-[13px] text-[#B5BAC1]">
                  🎫 {name || 'Seleziona...'}
                </span>
                <span className="text-[#949BA4] text-sm">▼</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center">
                <span className="text-white text-[8px]">B</span>
              </div>
              <span className="text-[10px] text-[#949BA4]">Broski Community • Usa /ticket per aprire un ticket</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketPreview;
