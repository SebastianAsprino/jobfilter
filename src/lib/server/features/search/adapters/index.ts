import type { PlatformAdapter } from './types';
import { computrabajo } from './computrabajo';
import { elempleo } from './elempleo';
import { getonbrd } from './getonbrd';
import { hireline } from './hireline';
import { linkedin } from './linkedin';
import { peaku } from './peaku';

// Una entrada por plataforma integrada. Cómo agregar una: docs/plataformas.md
export const adapters: PlatformAdapter[] = [getonbrd, computrabajo, linkedin, elempleo, peaku, hireline];
