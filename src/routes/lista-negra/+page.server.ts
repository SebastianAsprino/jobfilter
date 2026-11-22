import { unlistCompany } from '#lib/server/features/companies/commands/unlist-company';
import { whitelistCompany } from '#lib/server/features/companies/commands/whitelist-company';
import { listCompanies } from '#lib/server/features/companies/queries/list-companies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	negra: listCompanies('negra'),
	blanca: listCompanies('blanca')
});

const idFrom = async (request: Request) => Number((await request.formData()).get('id'));

export const actions: Actions = {
	blanca: async ({ request }) => whitelistCompany(await idFrom(request)),
	/** Sale de la lista (blanca o bloqueo a mano) y se vuelve a evaluar con la regla automática. */
	quitar: async ({ request }) => unlistCompany(await idFrom(request))
};
