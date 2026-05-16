import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { normalizeSocioName, getAmount, getInvestorName } from '../utils/dataHelpers';
import { parseSafeDate } from '../utils/dateFormatter';

/**
 * GMA SOCIOS 2 - useGmaData (Supabase version)
 * Centralized data provider using Supabase Realtime subscriptions.
 */
export const useGmaData = () => {
  const [socios, setSocios] = useState([]);
  const [inversiones, setInversiones] = useState([]);
  const [retornos, setRetornos] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const handleError = (table, err) => {
      console.error(`Error fetching ${table}:`, err);
      if (mounted) setError(`Error al cargar datos de ${table}`);
    };

    // Initial fetch + subscribe helper
    const subscribeTable = (table, orderCol, mapper, setter) => {
      // Initial load
      const fetchData = async () => {
        const query = supabase.from(table).select('*');
        if (orderCol) query.order(orderCol, { ascending: false });
        const { data, error: err } = await query;
        if (err) { handleError(table, err); return; }
        if (mounted) setter((data || []).map(mapper));
      };
      fetchData();

      // Realtime subscription
      const channel = supabase
        .channel(`realtime:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          fetchData(); // re-fetch on any change
        })
        .subscribe();

      return channel;
    };

    const mapSocio = (row) => ({
      ...row,
      nombre: String(row.nombre || row.socio || row.name || 'Socio Sin Nombre'),
      email: String(row.email || row.correo || ''),
      telefono: String(row.telefono || row.phone || ''),
    });

    const mapInversion = (row) => ({
      ...row,
      cantidad: getAmount(row),
      nombreInversionista: normalizeSocioName(getInvestorName(row)),
      tipo: row.tipo || 'dinero',
      fechaObj: parseSafeDate(row.fecha),
      fileUrls: row.file_urls || (row.comprobante_url ? [row.comprobante_url] : []),
    });

    const mapRetorno = (row) => ({
      ...row,
      cantidad: getAmount(row),
      nombreInversionista: normalizeSocioName(getInvestorName(row)),
      tipo: row.tipo || 'dinero',
      fechaObj: parseSafeDate(row.fecha),
      fileUrls: row.file_urls || (row.comprobante_url ? [row.comprobante_url] : []),
    });

    const mapCashflow = (row) => ({ ...row });

    const ch1 = subscribeTable('socios', 'created_at', mapSocio, setSocios);
    const ch2 = subscribeTable('records', 'fecha', mapInversion, setInversiones);
    const ch3 = subscribeTable('returns', 'created_at', mapRetorno, (data) => {
      setRetornos(data);
      if (mounted) setLoading(false);
    });
    const ch4 = subscribeTable('cashflow', 'mes', mapCashflow, setCashflow);

    // Load settings (no realtime needed)
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('*').eq('id', 'financials').single();
      if (data && mounted) setSettings(data);
    };
    loadSettings();

    return () => {
      mounted = false;
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
    };
  }, []);

  // --- Computed Global Stats ---
  const stats = useMemo(() => {
    const totalInvested = inversiones.reduce((sum, i) => sum + i.cantidad, 0);
    const totalReturned = retornos.reduce((sum, r) => sum + r.cantidad, 0);
    const totalReturnedToInvestors = retornos
      .filter(r => normalizeSocioName(getInvestorName(r)) !== 'DR. EDUARDO')
      .reduce((sum, r) => sum + r.cantidad, 0);

    return {
      totalInvested,
      totalReturned,
      totalReturnedToInvestors,
      remainingInvestment: Math.max(0, totalInvested - totalReturnedToInvestors),
      recoveryProgress: totalInvested > 0 ? (totalReturnedToInvestors / totalInvested) * 100 : 0
    };
  }, [inversiones, retornos]);

  // --- Partner Breakdown ---
  const partnerSummaries = useMemo(() => {
    const map = {};
    socios.forEach(s => {
      const name = normalizeSocioName(s.nombre);
      map[name] = { id: s.id, nombre: s.nombre, isTemp: false, totalInvested: 0, totalReturned: 0, countInv: 0, countRet: 0 };
    });
    inversiones.forEach(inv => {
      const name = inv.nombreInversionista;
      if (!map[name]) map[name] = { id: `temp_${name}`, nombre: name, isTemp: true, totalInvested: 0, totalReturned: 0, countInv: 0, countRet: 0 };
      map[name].totalInvested += inv.cantidad;
      map[name].countInv++;
    });
    retornos.forEach(ret => {
      const name = ret.nombreInversionista;
      if (!map[name]) map[name] = { id: `temp_${name}`, nombre: name, isTemp: true, totalInvested: 0, totalReturned: 0, countInv: 0, countRet: 0 };
      map[name].totalReturned += ret.cantidad;
      map[name].countRet++;
    });
    return Object.values(map).sort((a, b) => b.totalInvested - a.totalInvested);
  }, [socios, inversiones, retornos]);

  return { socios, inversiones, retornos, cashflow, settings, loading, error, stats, partnerSummaries };
};
