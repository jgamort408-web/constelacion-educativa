import { create } from 'zustand';
import type { Finding, ProjectSnapshot, Uuid } from '@/domain';
import { validateSnapshot } from '@/domain';
import type { Patch, ProjectRepository } from '@/data';
import {
  adoptForProject,
  IndexedDbProjectRepository,
  loadCatalogue,
  matchSubjects,
  openProject,
} from '@/data';

/**
 * Estado de la aplicación.
 *
 * Guarda el snapshot completo y nada derivado de él: la matriz, las alertas por
 * severidad y los vecinos de un nodo se calculan con selectores memoizados en cada
 * pantalla. Duplicar aquí lo que se puede derivar es lo que hace que dos vistas
 * acaben discrepando, y la §5 exige justo lo contrario.
 *
 * ── Trampa de Zustand que este archivo evita deliberadamente ──
 * Un selector NUNCA debe construir un valor nuevo (`?? []`, `.map()`, un objeto
 * literal). Devolvería una referencia distinta en cada render, React volvería a
 * renderizar, el selector volvería a ejecutarse: bucle infinito, error #185 y
 * pantalla en blanco. Los selectores de aquí devuelven primitivas o la referencia
 * que ya está en el estado; lo derivado se calcula con `useMemo` en el componente.
 */

export interface AppState {
  status: 'inicial' | 'cargando' | 'listo' | 'error';
  error: string | null;

  snapshot: ProjectSnapshot | null;
  findings: readonly Finding[];

  /** Nodo seleccionado en el mapa o en el panel de trazabilidad. */
  selectedId: Uuid | null;

  /** Pilas de deshacer y rehacer (§10). Guardan patches, no copias del proyecto. */
  undoStack: readonly Patch[];
  redoStack: readonly Patch[];
  /** Etiqueta del último cambio, para poder decir qué se va a deshacer. */
  lastAction: string | null;

  /** Hay una carga de currículo en curso. */
  loadingCurriculum: boolean;
  /** Aviso de la última carga: materias que no se pudieron emparejar. */
  curriculumNotice: string | null;

  load: () => Promise<void>;
  select: (id: Uuid | null) => void;
  adoptOfficialCurriculum: () => Promise<void>;
  dropOfficialCurriculum: () => Promise<void>;
  apply: (patch: Patch) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

let repository: ProjectRepository = new IndexedDbProjectRepository();

/** Sustituye el repositorio. Lo usan las pruebas y una futura implementación remota. */
export function setRepository(next: ProjectRepository): void {
  repository = next;
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'inicial',
  error: null,
  snapshot: null,
  findings: [],
  selectedId: null,
  undoStack: [],
  redoStack: [],
  lastAction: null,
  loadingCurriculum: false,
  curriculumNotice: null,

  async load() {
    set({ status: 'cargando', error: null });
    try {
      const snapshot = await openProject(repository);
      if (!snapshot) {
        set({ status: 'error', error: 'No se pudo abrir ningún proyecto.' });
        return;
      }
      set({
        status: 'listo',
        snapshot,
        findings: validateSnapshot(snapshot),
        selectedId: snapshot.activities[0]?.id ?? null,
      });
    } catch (cause) {
      set({
        status: 'error',
        error: cause instanceof Error ? cause.message : 'Error desconocido al abrir el proyecto.',
      });
    }
  },

  select(id) {
    set({ selectedId: id });
  },

  /**
   * Descarga el catálogo oficial, lo empareja con las materias del proyecto y lo
   * guarda.
   *
   * El emparejamiento es por nombre y puede fallar: si el equipo llama a su
   * materia de otra forma, su currículo no se enlaza. Eso se avisa en vez de
   * dejar una lista vacía sin explicación.
   */
  async adoptOfficialCurriculum() {
    const { snapshot } = get();
    if (!snapshot) return;

    set({ loadingCurriculum: true, error: null, curriculumNotice: null });
    try {
      const catalogo = await loadCatalogue();
      const emparejamiento = matchSubjects(catalogo, snapshot);
      const adoptado = adoptForProject(catalogo, emparejamiento);

      await repository.adoptCurriculum(adoptado);
      const actualizado = await repository.load(snapshot.project.id);

      const aviso =
        emparejamiento.unmatchedProject.length > 0
          ? `Sin currículo oficial para: ${emparejamiento.unmatchedProject.join(', ')}. ` +
            'El catálogo empareja las materias por su nombre.'
          : null;

      set({
        snapshot: actualizado,
        findings: validateSnapshot(actualizado),
        loadingCurriculum: false,
        curriculumNotice: aviso,
        // La pila de deshacer no cubre esta operación: se revierte con
        // «Retirar currículo oficial», que es una decisión, no un Ctrl+Z.
        undoStack: [],
        redoStack: [],
      });
    } catch (cause) {
      set({
        loadingCurriculum: false,
        error: cause instanceof Error ? cause.message : 'No se pudo cargar el currículo.',
      });
    }
  },

  async dropOfficialCurriculum() {
    const { snapshot } = get();
    if (!snapshot) return;

    set({ loadingCurriculum: true, error: null, curriculumNotice: null });
    try {
      await repository.removeOfficialCurriculum();
      const actualizado = await repository.load(snapshot.project.id);
      set({
        snapshot: actualizado,
        findings: validateSnapshot(actualizado),
        loadingCurriculum: false,
        undoStack: [],
        redoStack: [],
      });
    } catch (cause) {
      set({
        loadingCurriculum: false,
        error: cause instanceof Error ? cause.message : 'No se pudo retirar el currículo.',
      });
    }
  },

  async apply(patch) {
    const { snapshot } = get();
    if (!snapshot) return;

    try {
      const result = await repository.applyPatch(snapshot.project.id, patch);
      set((state) => ({
        snapshot: result.snapshot,
        findings: result.findings,
        undoStack: [...state.undoStack, result.inverse],
        // Un cambio nuevo invalida el rehacer: la rama que se iba a rehacer ya no
        // existe. Conservarla llevaría a rehacer sobre un estado distinto.
        redoStack: [],
        lastAction: patch.label,
        error: null,
      }));
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : 'No se pudo aplicar el cambio.' });
    }
  },

  async undo() {
    const { snapshot, undoStack } = get();
    const patch = undoStack.at(-1);
    if (!snapshot || !patch) return;

    const result = await repository.applyPatch(snapshot.project.id, patch);
    set((state) => ({
      snapshot: result.snapshot,
      findings: result.findings,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, result.inverse],
      lastAction: patch.label,
    }));
  },

  async redo() {
    const { snapshot, redoStack } = get();
    const patch = redoStack.at(-1);
    if (!snapshot || !patch) return;

    const result = await repository.applyPatch(snapshot.project.id, patch);
    set((state) => ({
      snapshot: result.snapshot,
      findings: result.findings,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, result.inverse],
      lastAction: patch.label,
    }));
  },
}));

/*
 * Selectores.
 *
 * Cada uno devuelve una primitiva o una referencia ya presente en el estado.
 * Ninguno construye nada.
 */
export const selectStatus = (state: AppState) => state.status;
export const selectError = (state: AppState) => state.error;
export const selectSnapshot = (state: AppState) => state.snapshot;
export const selectFindings = (state: AppState) => state.findings;
export const selectSelectedId = (state: AppState) => state.selectedId;
export const selectLastAction = (state: AppState) => state.lastAction;
export const selectCanUndo = (state: AppState) => state.undoStack.length > 0;
export const selectCanRedo = (state: AppState) => state.redoStack.length > 0;
export const selectLoadingCurriculum = (state: AppState) => state.loadingCurriculum;
export const selectCurriculumNotice = (state: AppState) => state.curriculumNotice;
