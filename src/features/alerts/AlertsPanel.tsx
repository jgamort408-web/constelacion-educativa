import { useMemo } from 'react';
import type { Finding, NodeDescriptor, Severity, Uuid } from '@/domain';

/**
 * Panel de alertas pedagógicas (§11).
 *
 * Agrupa por severidad y colapsa las repeticiones de una misma regla. Un panel que
 * enumera diecisiete veces «este criterio no tiene instrumento» es un panel que se
 * ignora al tercer día, y entonces deja de avisar también de lo que sí importa.
 */

interface Props {
  findings: readonly Finding[];
  nodes: Map<Uuid, NodeDescriptor>;
  onSelect: (id: Uuid) => void;
}

const SEVERITY_STYLE: Record<Severity, { label: string; chip: string; rule: string }> = {
  ERROR: {
    label: 'Errores',
    chip: 'bg-rose-500/15 text-rose-300',
    rule: 'border-rose-500/40',
  },
  ADVERTENCIA: {
    label: 'Advertencias',
    chip: 'bg-amber-500/15 text-amber-300',
    rule: 'border-amber-500/40',
  },
  SUGERENCIA: {
    label: 'Sugerencias',
    chip: 'bg-sky-500/15 text-sky-300',
    rule: 'border-sky-500/40',
  },
};

const ORDER: Severity[] = ['ERROR', 'ADVERTENCIA', 'SUGERENCIA'];

export function AlertsPanel({ findings, nodes, onSelect }: Props) {
  const grouped = useMemo(() => {
    const bySeverity = new Map<Severity, Map<string, Finding[]>>();

    for (const finding of findings) {
      const rules = bySeverity.get(finding.severity) ?? new Map<string, Finding[]>();
      const list = rules.get(finding.rule) ?? [];
      list.push(finding);
      rules.set(finding.rule, list);
      bySeverity.set(finding.severity, rules);
    }

    return bySeverity;
  }, [findings]);

  if (findings.length === 0) {
    return <p className="text-sm text-tinta-300">El proyecto no tiene ninguna alerta pendiente.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {ORDER.map((severity) => {
        const rules = grouped.get(severity);
        if (!rules || rules.size === 0) return null;
        const style = SEVERITY_STYLE[severity];
        const total = [...rules.values()].reduce((sum, list) => sum + list.length, 0);

        return (
          <section key={severity} aria-labelledby={`alertas-${severity}`}>
            <h3 id={`alertas-${severity}`} className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase ${style.chip}`}
              >
                {style.label}
              </span>
              <span className="font-mono text-xs text-tinta-500 tabular-nums">{total}</span>
            </h3>

            <div className="mt-2 flex flex-col gap-3">
              {[...rules.entries()].map(([rule, list]) => {
                const first = list[0];
                if (!first) return null;

                return (
                  <article key={rule} className={`border-l-2 pl-3 ${style.rule}`}>
                    <p className="text-sm text-tinta-100">{first.message}</p>
                    {first.hint && <p className="mt-1 text-xs text-tinta-500">{first.hint}</p>}

                    {list.length > 1 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-mono text-[11px] text-tinta-500 hover:text-laton-400">
                          Y {list.length - 1} caso{list.length > 2 ? 's' : ''} más igual
                          {list.length > 2 ? 'es' : ''}
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1 border-l border-cielo-600 pl-3">
                          {list.slice(1).map((finding, position) => (
                            <li key={`${rule}:${position}`} className="text-xs text-tinta-300">
                              {finding.message}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {first.nodeIds.slice(0, 3).map((nodeId) => {
                        const descriptor = nodes.get(nodeId);
                        if (!descriptor) return null;
                        return (
                          <button
                            key={nodeId}
                            type="button"
                            onClick={() => {
                              onSelect(nodeId);
                            }}
                            className="rounded bg-cielo-700 px-2 py-0.5 text-[11px] text-tinta-300 hover:text-laton-400"
                          >
                            {descriptor.label}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
