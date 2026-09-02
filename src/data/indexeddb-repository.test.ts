import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateSnapshot } from '@/domain';
import { ConstelacionDatabase } from './database.ts';
import { buildDemoSnapshot } from './demo/ejemplo.ts';
import { IndexedDbProjectRepository } from './indexeddb-repository.ts';
import { openProject, seedIfEmpty } from './bootstrap.ts';
import { mutation, RepositoryError, singlePatch } from './repository.ts';

/**
 * Pruebas de la base de datos contra IndexedDB de verdad.
 *
 * `fake-indexeddb` implementa la especificación completa, incluidas las
 * transacciones y su aislamiento. Simular el repositorio con un objeto en memoria
 * probaría el simulacro, no la base: los fallos reales de esta capa son
 * precisamente los de transacciones e índices.
 *
 * Cada prueba estrena una base con nombre propio, para que el orden en que se
 * ejecuten no pueda influir en el resultado.
 */

let db: ConstelacionDatabase;
let repository: IndexedDbProjectRepository;
let counter = 0;

beforeEach(() => {
  counter += 1;
  db = new ConstelacionDatabase(`prueba-${counter}`);
  repository = new IndexedDbProjectRepository(db);
});

afterEach(async () => {
  db.close();
  await ConstelacionDatabase.delete(`prueba-${counter}`);
});

describe('guardar y cargar', () => {
  it('una base recién creada está vacía', async () => {
    expect(await repository.isEmpty()).toBe(true);
    expect(await repository.list()).toEqual([]);
  });

  it('guarda el proyecto DEMO completo y lo recupera igual', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    const loaded = await repository.load(original.project.id);

    expect(loaded.project).toEqual(original.project);
    expect(loaded.activities).toHaveLength(original.activities.length);
    expect(loaded.edges).toHaveLength(original.edges.length);
    expect(loaded.sessions).toHaveLength(original.sessions.length);
    expect(loaded.evaluationCriteria).toHaveLength(original.evaluationCriteria.length);
  });

  it('el proyecto recuperado sigue siendo válido y sin errores', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    const loaded = await repository.load(original.project.id);
    const errors = validateSnapshot(loaded).filter((f) => f.severity === 'ERROR');
    expect(errors).toEqual([]);
  });

  it('devuelve las situaciones ordenadas, no en el orden que dé la base', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    const loaded = await repository.load(original.project.id);
    const orders = loaded.learningSituations.map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('devuelve siempre el mismo orden, aunque la base no lo garantice', async () => {
    // IndexedDB devuelve las filas en el orden que le conviene. Sin ordenación
    // explícita, la matriz de contribución y la barra lateral salían barajadas
    // en cada carga, y un docente que ve sus actividades cambiar de sitio deja
    // de fiarse de la herramienta.
    const original = buildDemoSnapshot();
    await repository.save(original);

    const primera = await repository.load(original.project.id);
    const segunda = await repository.load(original.project.id);

    expect(segunda.subjects.map((s) => s.id)).toEqual(primera.subjects.map((s) => s.id));
    expect(segunda.activities.map((a) => a.id)).toEqual(primera.activities.map((a) => a.id));
    expect(segunda.sessions.map((s) => s.id)).toEqual(primera.sessions.map((s) => s.id));
  });

  it('ordena las materias alfabéticamente y las actividades por su posición', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const loaded = await repository.load(original.project.id);

    const names = loaded.subjects.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));

    const orders = loaded.activities.map((a) => a.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('las sesiones salen en orden cronológico', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const loaded = await repository.load(original.project.id);

    const moments = loaded.sessions.map((s) => `${s.date}T${s.startTime}`);
    expect(moments).toEqual([...moments].sort());
  });

  it('resume el proyecto sin cargarlo entero', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    const [summary] = await repository.list();
    // Se comparan con el propio ejemplo, no con cifras escritas a mano: así la
    // prueba sigue valiendo cuando el ejemplo cambie.
    expect(summary?.title).toBe(original.project.title);
    expect(summary?.subjectCount).toBe(original.subjects.length);
    expect(summary?.activityCount).toBe(original.activities.length);
  });

  it('guardar dos veces sustituye, no duplica', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    await repository.save(original);

    const loaded = await repository.load(original.project.id);
    expect(loaded.activities).toHaveLength(original.activities.length);
    expect(await repository.list()).toHaveLength(1);
  });

  it('avisa con un mensaje legible al abrir un proyecto que no existe', async () => {
    await expect(repository.load('00000000-0000-4000-8000-000000000000')).rejects.toThrow(
      RepositoryError,
    );
  });

  it('rechaza guardar datos que no cumplen el modelo, y dice qué falla', async () => {
    const broken = {
      ...buildDemoSnapshot(),
      project: { ...buildDemoSnapshot().project, title: '' },
    };

    await expect(repository.save(broken)).rejects.toThrow(RepositoryError);
    await repository.save(broken).catch((error: unknown) => {
      expect(error).toBeInstanceOf(RepositoryError);
      expect((error as RepositoryError).details.join(' ')).toContain('title');
    });
  });
});

describe('edición: crear, modificar y borrar', () => {
  it('modifica una actividad sin tocar el resto del proyecto', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const activity = original.activities[0];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch(
        'Renombró una actividad',
        mutation.upsert('activity', { ...activity, title: 'Título nuevo' }),
      ),
    );

    expect(result.snapshot.activities.find((a) => a.id === activity.id)?.title).toBe(
      'Título nuevo',
    );
    expect(result.snapshot.activities).toHaveLength(original.activities.length);
    expect(result.snapshot.edges).toHaveLength(original.edges.length);
  });

  it('crea una entidad nueva', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const situation = original.learningSituations[0];
    if (!situation) throw new Error('el ejemplo debería tener situaciones');

    const nueva = {
      id: '11111111-1111-4111-8111-111111111111',
      projectId: original.project.id,
      learningSituationId: situation.id,
      title: 'Actividad añadida a mano',
      description: '',
      order: 99,
      estimatedSessions: 1,
      status: 'PENDIENTE' as const,
      product: '',
      materials: '',
    };

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch('Creó una actividad', mutation.upsert('activity', nueva)),
    );

    expect(result.snapshot.activities).toHaveLength(original.activities.length + 1);
  });

  it('borra una entidad', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const activity = original.activities[0];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch('Borró una actividad', mutation.remove('activity', activity.id)),
    );

    expect(result.snapshot.activities).toHaveLength(original.activities.length - 1);
  });

  it('actualiza los datos del proyecto', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch(
        'Cambió el título del proyecto',
        mutation.updateProject({ ...original.project, title: 'Otro título' }),
      ),
    );

    expect(result.snapshot.project.title).toBe('Otro título');
  });

  it('devuelve las alertas actualizadas tras el cambio', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const situation = original.learningSituations[0];
    if (!situation) throw new Error('el ejemplo debería tener situaciones');

    // Borrar una situación deja huérfanas las actividades que colgaban de ella.
    const result = await repository.applyPatch(
      original.project.id,
      singlePatch('Borró una situación', mutation.remove('learningSituation', situation.id)),
    );

    expect(result.findings.some((f) => f.severity === 'ERROR')).toBe(true);
  });

  it('rechaza un cambio inválido sin dejar rastro', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const activity = original.activities[0];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    await expect(
      repository.applyPatch(
        original.project.id,
        singlePatch('Cambio inválido', mutation.upsert('activity', { ...activity, title: '' })),
      ),
    ).rejects.toThrow(RepositoryError);

    const loaded = await repository.load(original.project.id);
    expect(loaded.activities.find((a) => a.id === activity.id)?.title).toBe(activity.title);
  });
});

describe('transacciones', () => {
  it('aplica varias mutaciones como una sola unidad', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const [first, second] = original.activities;
    if (!first || !second) throw new Error('el ejemplo debería tener actividades');

    const result = await repository.applyPatch(original.project.id, {
      label: 'Renombró dos actividades a la vez',
      mutations: [
        mutation.upsert('activity', { ...first, title: 'Primera renombrada' }),
        mutation.upsert('activity', { ...second, title: 'Segunda renombrada' }),
      ],
    });

    expect(result.snapshot.activities.find((a) => a.id === first.id)?.title).toBe(
      'Primera renombrada',
    );
    expect(result.snapshot.activities.find((a) => a.id === second.id)?.title).toBe(
      'Segunda renombrada',
    );
  });

  it('si una mutación del grupo falla, no se aplica ninguna', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const [first, second] = original.activities;
    if (!first || !second) throw new Error('el ejemplo debería tener actividades');

    await expect(
      repository.applyPatch(original.project.id, {
        label: 'Un cambio bueno y uno malo',
        mutations: [
          mutation.upsert('activity', { ...first, title: 'Este sí valdría' }),
          mutation.upsert('activity', { ...second, estimatedSessions: -5 }),
        ],
      }),
    ).rejects.toThrow(RepositoryError);

    // La clave: el primer cambio, que era válido, tampoco se aplicó.
    const loaded = await repository.load(original.project.id);
    expect(loaded.activities.find((a) => a.id === first.id)?.title).toBe(first.title);
  });
});

describe('deshacer', () => {
  it('el inverso de modificar restaura el valor anterior', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const activity = original.activities[0];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch('Renombró', mutation.upsert('activity', { ...activity, title: 'Cambiado' })),
    );
    await repository.applyPatch(original.project.id, result.inverse);

    const loaded = await repository.load(original.project.id);
    expect(loaded.activities.find((a) => a.id === activity.id)?.title).toBe(activity.title);
  });

  it('el inverso de borrar vuelve a crear lo borrado, tal cual estaba', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const activity = original.activities[3];
    if (!activity) throw new Error('el ejemplo debería tener actividades');

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch('Borró', mutation.remove('activity', activity.id)),
    );
    await repository.applyPatch(original.project.id, result.inverse);

    const loaded = await repository.load(original.project.id);
    expect(loaded.activities.find((a) => a.id === activity.id)).toEqual(activity);
  });

  it('el inverso de crear borra lo creado', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const situation = original.learningSituations[0];
    if (!situation) throw new Error('el ejemplo debería tener situaciones');

    const result = await repository.applyPatch(
      original.project.id,
      singlePatch(
        'Creó',
        mutation.upsert('activity', {
          id: '22222222-2222-4222-8222-222222222222',
          projectId: original.project.id,
          learningSituationId: situation.id,
          title: 'Temporal',
          description: '',
          order: 99,
          estimatedSessions: 1,
          status: 'PENDIENTE',
          product: '',
          materials: '',
        }),
      ),
    );
    await repository.applyPatch(original.project.id, result.inverse);

    const loaded = await repository.load(original.project.id);
    expect(loaded.activities).toHaveLength(original.activities.length);
  });

  it('deshace un grupo de cambios en el orden correcto', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    const [first, second] = original.activities;
    if (!first || !second) throw new Error('el ejemplo debería tener actividades');

    const result = await repository.applyPatch(original.project.id, {
      label: 'Dos cambios',
      mutations: [
        mutation.upsert('activity', { ...first, title: 'A' }),
        mutation.upsert('activity', { ...second, title: 'B' }),
      ],
    });
    await repository.applyPatch(original.project.id, result.inverse);

    const loaded = await repository.load(original.project.id);
    expect(loaded.activities.find((a) => a.id === first.id)?.title).toBe(first.title);
    expect(loaded.activities.find((a) => a.id === second.id)?.title).toBe(second.title);
  });
});

describe('copias de seguridad', () => {
  it('guarda una copia y la lista', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    await repository.backup(original.project.id, 'manual');
    const backups = await repository.listBackups(original.project.id);

    expect(backups).toHaveLength(1);
    expect(backups[0]?.reason).toBe('manual');
  });

  it('la copia contiene un proyecto que se puede volver a cargar', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);
    await repository.backup(original.project.id, 'manual');

    const [backup] = await repository.listBackups(original.project.id);
    const restored: unknown = JSON.parse(backup?.payload ?? '{}');

    expect((restored as { activities: unknown[] }).activities).toHaveLength(
      original.activities.length,
    );
  });

  it('conserva solo las diez más recientes, para no llenar el disco', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    for (let i = 0; i < 13; i += 1) {
      await repository.backup(original.project.id, 'automatica');
    }

    expect(await repository.listBackups(original.project.id)).toHaveLength(10);
  });
});

describe('borrado y arranque', () => {
  it('borrar un proyecto se lleva todo lo que colgaba de él', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    await repository.remove(original.project.id);

    expect(await repository.isEmpty()).toBe(true);
    expect(await db.activities.count()).toBe(0);
    expect(await db.edges.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });

  it('siembra el ejemplo la primera vez', async () => {
    const projectId = await seedIfEmpty(repository);

    expect(projectId).not.toBeNull();
    expect(await repository.isEmpty()).toBe(false);
  });

  it('NO vuelve a sembrar si ya hay datos', async () => {
    const original = buildDemoSnapshot();
    await repository.save(original);

    await repository.applyPatch(
      original.project.id,
      singlePatch(
        'Cambió el título',
        mutation.updateProject({ ...original.project, title: 'Mi proyecto de verdad' }),
      ),
    );

    await seedIfEmpty(repository);

    // Si volviera a sembrar, el título habría vuelto al del ejemplo y el docente
    // habría perdido su trabajo sin ningún aviso.
    const loaded = await repository.load(original.project.id);
    expect(loaded.project.title).toBe('Mi proyecto de verdad');
  });

  it('openProject devuelve el proyecto listo para usar', async () => {
    const snapshot = await openProject(repository);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.activities).toHaveLength(buildDemoSnapshot().activities.length);
  });
});
