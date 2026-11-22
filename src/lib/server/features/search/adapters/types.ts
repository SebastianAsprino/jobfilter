import type { HttpClient } from '#lib/server/shared/http';
import type { Location } from '#lib/server/shared/profile';

export type Modality = 'remoto' | 'hibrido' | 'presencial';

/** Vacante tal como la entrega un adapter, ya filtrada por ubicación e idioma. */
export type RawPosting = {
	externalId: string;
	url: string;
	title: string;
	company: string | null;
	/** Quien publica, si la plataforma lo muestra (reclutador, cuenta, etc.). */
	recruiter?: string;
	location?: string;
	modality?: Modality;
	description?: string;
	publishedAt: Date;
	/** Fecha tal como vino de la plataforma ("hace 3 días", timestamp, etc.). */
	publishedRaw: string;
	/**
	 * La fecha es solo un tope ("Más de 30 días") o no se entendió: se guarda la primera vez,
	 * pero no se usa para detectar republicaciones.
	 */
	publishedApprox?: boolean;
};

export type SearchContext = {
	client: HttpClient;
	/** Solo interesan vacantes publicadas desde esta fecha. */
	since: Date;
	/** Dónde puedes trabajar (profile/location.json); cada adapter filtra con esto. */
	location: Location;
};

export interface PlatformAdapter {
	id: string;
	name: string;
	/** Pausa aleatoria entre peticiones, en milisegundos. */
	delay: { min: number; max: number };
	/**
	 * La plataforma busca por sinónimos ("tech lead" → "Líder técnico de instalaciones"): la
	 * búsqueda descarta las vacantes cuyo título y descripción no mencionan el término.
	 */
	looseSearch?: boolean;
	/**
	 * Máximo de peticiones por búsqueda, para plataformas que limitan mucho (LinkedIn). Al
	 * llegar, la búsqueda se detiene y las palabras que faltaron siguen en la próxima.
	 */
	maxRequestsPerRun?: number;
	/**
	 * Escalera de pausas ante bloqueos seguidos, en minutos: el primero usa el primer escalón.
	 * Por defecto: 1 día, 2, 4 y una semana.
	 */
	pauseMinutes?: number[];
	/**
	 * Freno contra apretar Buscar muchas veces: minutos mínimos entre dos corridas de esta
	 * plataforma. Mientras tanto se muestra en pausa y las demás plataformas buscan normal.
	 */
	minGapMinutes?: number;
	/** Cada palabra clave se vuelve a buscar en esta plataforma como mucho cada tantas horas. */
	refreshEveryHours?: number;
	/** Ante un 429, esperar esto (ms) y reintentar una vez antes de pausar la plataforma. */
	blockRetryMs?: number;
	/** Guardar las cookies de la sesión anónima durante la búsqueda (por defecto, sí). */
	cookies?: boolean;
	/** No seguir redirecciones: cualquier redirección cuenta como bloqueo (muro de login). */
	blockRedirects?: boolean;
	/** Cualquier error que corte la búsqueda (no solo un bloqueo) pausa la plataforma. */
	pauseOnErrors?: boolean;
	/**
	 * Pedir el detalle solo si el título de la tarjeta menciona alguna palabra clave del perfil.
	 * Para plataformas cuyo detalle es caro (LinkedIn): las que no pasan no gastan petición.
	 */
	prefilterByTitle?: boolean;
	search(term: string, ctx: SearchContext): AsyncGenerator<RawPosting>;
	/**
	 * Para plataformas cuyo listado no trae la descripción: la búsqueda lo llama solo con las
	 * vacantes que todavía no están en la base, y mezcla lo que devuelva.
	 */
	fetchDetail?(posting: RawPosting, ctx: SearchContext): Promise<Partial<RawPosting>>;
}
