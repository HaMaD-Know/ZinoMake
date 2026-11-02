import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { buildToolbox } from '../../programming/blocks/register';
import { CALL_BLOCK_BY_TYPE, CATEGORIES } from '../../programming/blocks/catalog';
import type { ProjectType } from '../../model/project';

const SPECIAL_LABELS: Record<string, string> = {
  math_number: 'a number',
  text: 'some text',
  math_arithmetic: '… + … (maths)',
  controls_if: 'if … then',
  logic_compare: '… = … (compare)',
  logic_operation: '… and / or …',
  logic_negate: 'not …',
  logic_boolean: 'true / false',
  zm_repeat: 'repeat … times',
  zm_while: 'repeat while …',
  zm_note: 'note',
  zm_function_def: 'make a block called …',
};

export function blockLabel(item: Record<string, unknown>): string {
  const type = String(item.type);
  if (type === 'controls_if' && (item.extraState as { hasElse?: boolean } | undefined)?.hasElse) return 'if … then … otherwise';
  if (type === 'logic_compare' && (item.fields as { OP?: string } | undefined)?.OP === 'GT') return '… > … (bigger than)';
  if (type === 'logic_operation' && (item.fields as { OP?: string } | undefined)?.OP === 'OR') return '… or …';
  if (type === 'logic_operation') return '… and …';
  if (SPECIAL_LABELS[type]) return SPECIAL_LABELS[type];
  const spec = CALL_BLOCK_BY_TYPE.get(type);
  if (spec) return spec.message.replace(/%\d+/g, '…').replace(/^[^\p{L}…]+/u, '').trim();
  return type;
}

/** Keyboard- and touch-friendly way to add blocks without dragging. */
export function AddBlockDialog({ type, onPick, onClose }: { type: ProjectType; onPick: (item: Record<string, unknown>) => void; onClose: () => void }) {
  const toolbox = buildToolbox(type) as unknown as { contents: { name: string; toolboxitemid: string; contents?: Record<string, unknown>[] }[] };
  const cats = toolbox.contents.filter((c) => c.contents && c.contents.length);
  const [cat, setCat] = useState(cats[0]?.toolboxitemid);
  const current = cats.find((c) => c.toolboxitemid === cat);
  return (
    <Dialog title="Add a block" onClose={onClose} wide>
      <p className="hint">Pick a block. It is added after the selected block, or inside “when Play is pressed”. Then you can drag it anywhere.</p>
      <div className="chips" role="tablist" aria-label="Block categories">
        {cats.map((c) => {
          const meta = CATEGORIES.find((x) => x.id === c.toolboxitemid);
          return (
            <button key={c.toolboxitemid} role="tab" className="chip" aria-selected={cat === c.toolboxitemid} aria-pressed={cat === c.toolboxitemid} onClick={() => setCat(c.toolboxitemid)}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: meta?.colour }} /> {c.name}
            </button>
          );
        })}
      </div>
      {current && (
        <div role="tabpanel" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {current.contents!.filter((i) => i.kind === 'block').map((item, i) => (
            <button key={i} className="btn" style={{ justifyContent: 'flex-start', borderLeft: `6px solid ${CATEGORIES.find((x) => x.id === cat)?.colour}` }} onClick={() => onPick(item)}>
              {blockLabel(item)}
            </button>
          ))}
        </div>
      )}
      <p className="hint" style={{ marginTop: 12 }}>To make variables or your own blocks, use the “Remember” and “My blocks” categories in the block list.</p>
    </Dialog>
  );
}
