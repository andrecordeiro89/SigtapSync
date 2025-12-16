import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Search } from 'lucide-react';
import { useSigtapContext } from '../contexts/SigtapContext';
import { Button } from './ui/button';

const normalize = (v?: string) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const SigtapCrossSearch: React.FC = () => {
	const { procedures } = useSigtapContext();
	const [term, setTerm] = useState('');
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	const results = useMemo(() => {
		const t = normalize(term);
		if (!t) return [] as typeof procedures;

		return procedures.filter(p => {
			const codeHit = p.code?.toLowerCase().includes(t);
			const descHit = normalize(p.description).includes(t);
			const cidHit = Array.isArray(p.cid) && p.cid.some(c => String(c).toLowerCase().includes(t));
			return codeHit || descHit || cidHit;
		}).slice(0, 200); // limitar para UI responsiva
	}, [procedures, term]);

	return (
		<Card className="bg-white border border-gray-200">
			<CardHeader className="p-3 border-b border-gray-200">
				<CardTitle className="flex items-center gap-2 text-black">
					<Search className="w-5 h-5 text-black" />
					<span className="font-semibold">Pesquisa por Procedimento ou CID</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 p-3">
				<div className="relative">
					<Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
					<Input
						placeholder="Digite código/descrição do procedimento ou um CID (ex: A310)"
						value={term}
						onChange={(e) => setTerm(e.target.value)}
						className="pl-10 border-gray-300 focus:border-black focus:ring-black"
					/>
				</div>

				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="min-w-[120px]">Código</TableHead>
								<TableHead className="min-w-[320px]">Procedimento</TableHead>
								<TableHead className="min-w-[280px]">CIDs compatíveis</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{results.map(proc => (
								<TableRow key={proc.code} className="align-top">
									<TableCell className="font-mono text-sm">{proc.code}</TableCell>
									<TableCell className="text-sm">{proc.description}</TableCell>
									<TableCell>
										{Array.isArray(proc.cid) && proc.cid.length > 0 ? (
											<div className="flex flex-col gap-2">
												<div className="flex flex-wrap gap-1">
										{(expanded.has(proc.code) ? proc.cid : proc.cid.slice(0, 12)).map((c, i) => (
											<Badge key={i} variant="outline" className="bg-white border-gray-200 text-black px-2 py-0.5">
												CID: {String(c)}
											</Badge>
										))}
												</div>
												{proc.cid.length > 12 && (
													<div>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 px-2 text-xs"
															onClick={() => {
																setExpanded(prev => {
																	const next = new Set(prev);
																	if (next.has(proc.code)) next.delete(proc.code); else next.add(proc.code);
																	return next;
																});
															}}
														>
															{expanded.has(proc.code) ? 'Ver menos' : `Ver todos (+${proc.cid.length - 12})`}
														</Button>
													</div>
												)}
											</div>
										) : (
											<span className="text-xs text-gray-500">Sem CIDs associados</span>
										)}
									</TableCell>
								</TableRow>
							))}
							{results.length === 0 && (
								<TableRow>
									<TableCell colSpan={3} className="text-center py-6 text-gray-500 text-sm">
										Digite um termo para pesquisar
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
};

export default SigtapCrossSearch;


