/**
 * Async wrapper around glpk.js (WASM GLPK).
 * The GLPK instance is initialised once and reused across calls.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _glpk: any = null;

export async function getGLPK() {
  if (_glpk) return _glpk;
  const mod = await import('glpk.js');
  const GLPK = mod.default ?? mod;
  _glpk = await GLPK();
  return _glpk;
}

export interface LPVar {
  name: string;
  coef: number;
}

export interface LPConstraint {
  name: string;
  vars: LPVar[];
  type: 'GE' | 'LE' | 'EQ';
  rhs: number;
}

export interface LPBound {
  name: string;
  type: 'FR' | 'LO' | 'UP' | 'FX' | 'DB';
  lb?: number;
  ub?: number;
}

export interface LPModel {
  name: string;
  direction: 'MAX' | 'MIN';
  objective: LPVar[];
  constraints: LPConstraint[];
  bounds?: LPBound[];
}

export interface LPResult {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  objectiveValue: number;
  vars: Record<string, number>;
}

export async function solveLP(model: LPModel): Promise<LPResult> {
  const glpk = await getGLPK();

  const cBndsMap = {
    GE: glpk.GLP_LO,
    LE: glpk.GLP_UP,
    EQ: glpk.GLP_FX,
  } as Record<string, number>;

  const vBndsMap = {
    FR: glpk.GLP_FR,
    LO: glpk.GLP_LO,
    UP: glpk.GLP_UP,
    FX: glpk.GLP_FX,
    DB: glpk.GLP_DB,
  } as Record<string, number>;

  const glpkModel = {
    name: model.name,
    objective: {
      direction: model.direction === 'MAX' ? glpk.GLP_MAX : glpk.GLP_MIN,
      name: 'obj',
      vars: model.objective,
    },
    subjectTo: model.constraints.map((c) => ({
      name: c.name,
      vars: c.vars,
      bnds: {
        type: cBndsMap[c.type],
        lb: c.type === 'EQ' ? c.rhs : c.type === 'GE' ? c.rhs : 0,
        ub: c.type === 'EQ' ? c.rhs : c.type === 'LE' ? c.rhs : 0,
      },
    })),
    bounds: (model.bounds ?? []).map((b) => ({
      name: b.name,
      type: vBndsMap[b.type],
      lb: b.lb ?? 0,
      ub: b.ub ?? 0,
    })),
  };

  try {
    // glpk.js resolves to a Promise in the browser/WASM build but returns the
    // result synchronously in the Node build. `await` handles both: awaiting a
    // plain value is a no-op, so the same code works in tests and in the app.
    const res = await glpk.solve(glpkModel, glpk.GLP_MSG_OFF);
    const statusMap: Record<number, LPResult['status']> = {
      [glpk.GLP_OPT]: 'optimal',
      [glpk.GLP_INFEAS]: 'infeasible',
      [glpk.GLP_UNBND]: 'unbounded',
      [glpk.GLP_UNDEF]: 'error',
      [glpk.GLP_NOFEAS]: 'infeasible',
    };
    return {
      status: statusMap[res.result.status] ?? 'error',
      objectiveValue: res.result.z ?? 0,
      vars: res.result.vars ?? {},
    };
  } catch {
    return { status: 'error', objectiveValue: 0, vars: {} };
  }
}
