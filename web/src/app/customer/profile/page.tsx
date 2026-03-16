'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Vehicle, VehicleCreate, CustomerProfile } from '@/types';
import { LogOut } from 'lucide-react';

const VEHICLE_CLASSES = ['sedan', 'suv', 'hatchback', 'pickup', 'van', 'truck', 'motorcycle', 'other'];
const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid'];

export default function CustomerProfilePage() {
  const { user, signIn, token, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Customer profile
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('');

  // Vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addError, setAddError] = useState('');
  const [newVehicle, setNewVehicle] = useState<VehicleCreate>({
    make: '',
    model: '',
    year: '',
    registration_number: '',
    colour: '',
    fuel_type: 'petrol',
    vehicle_class: 'sedan',
    is_default: false,
  });

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const p = await api.get<CustomerProfile>('/profile/');
      setProfile(p);
      setEmergencyName(p.emergency_contact_name ?? '');
      setEmergencyPhone(p.emergency_contact_phone ?? '');
      setPreferredPayment(p.preferred_payment_method ?? '');
    } catch {
      // profile may not exist yet — ignore
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadVehicles() {
    setVehiclesLoading(true);
    try {
      const v = await api.get<Vehicle[]>('/vehicles/');
      setVehicles(v);
    } catch {
      setVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    loadVehicles();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess(false);
    try {
      await api.put('/profile/', {
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        preferred_payment_method: preferredPayment || null,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddingVehicle(true);
    try {
      const v = await api.post<Vehicle>('/vehicles/', {
        make: newVehicle.make,
        model: newVehicle.model,
        year: newVehicle.year || undefined,
        registration_number: newVehicle.registration_number,
        colour: newVehicle.colour || undefined,
        fuel_type: newVehicle.fuel_type || undefined,
        vehicle_class: newVehicle.vehicle_class,
        is_default: newVehicle.is_default,
      });
      setVehicles([...vehicles, v]);
      setShowAddVehicle(false);
      setNewVehicle({
        make: '', model: '', year: '', registration_number: '', colour: '',
        fuel_type: 'petrol', vehicle_class: 'sedan', is_default: false,
      });
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add vehicle.');
    } finally {
      setAddingVehicle(false);
    }
  }

  async function deleteVehicle(id: number) {
    setDeletingId(id);
    try {
      await api.delete(`/vehicles/${id}`);
      setVehicles(vehicles.filter((v) => v.id !== id));
    } catch {
      // silently fail — show nothing
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        {confirmLogout ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Sign out?</span>
            <button onClick={signOut} className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium">Yes</button>
            <button onClick={() => setConfirmLogout(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs font-medium">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        )}
      </div>

      {/* Account Info (read-only) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Account</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center text-2xl font-bold text-yellow-600 flex-shrink-0">
            {user?.first_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-sm text-gray-500">{user?.phone}</p>
            {user?.email && <p className="text-sm text-gray-400">{user.email}</p>}
          </div>
        </div>
      </div>

      {/* Emergency Contact & Preferences */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Preferences</h2>
        {profileLoading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-4 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        ) : (
          <form onSubmit={saveProfile} className="space-y-4">
            {profileError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{profileError}</div>}
            {profileSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">✅ Profile saved!</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact name</label>
                <input
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact phone</label>
                <input
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+263771000000"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred payment method</label>
              <select
                value={preferredPayment}
                onChange={(e) => setPreferredPayment(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
              >
                <option value="">None</option>
                <option value="cash">Cash</option>
                <option value="ecocash">EcoCash</option>
                <option value="onemoney">OneMoney</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="py-2.5 px-6 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition text-sm"
            >
              {savingProfile ? 'Saving…' : 'Save preferences'}
            </button>
          </form>
        )}
      </div>

      {/* Vehicles */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">My Vehicles</h2>
          <button
            onClick={() => setShowAddVehicle(!showAddVehicle)}
            className="text-sm text-yellow-600 font-medium hover:underline flex items-center gap-1"
          >
            {showAddVehicle ? '✕ Cancel' : '+ Add vehicle'}
          </button>
        </div>

        {vehiclesLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-4 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {vehicles.length === 0 && !showAddVehicle && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">🚗</div>
                <p className="text-sm">No vehicles added yet</p>
              </div>
            )}
            <div className="space-y-3">
              {vehicles.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚗</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {v.year ? `${v.year} ` : ''}{v.make} {v.model}
                        {v.is_default && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">Default</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {v.registration_number}
                        {v.colour ? ` · ${v.colour}` : ''}
                        {v.fuel_type ? ` · ${v.fuel_type}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteVehicle(v.id)}
                    disabled={deletingId === v.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
                  >
                    {deletingId === v.id ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>

            {/* Add vehicle form */}
            {showAddVehicle && (
              <form onSubmit={addVehicle} className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Add new vehicle</h3>
                {addError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{addError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Make *</label>
                    <input
                      value={newVehicle.make}
                      onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                      required
                      placeholder="Toyota"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Model *</label>
                    <input
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                      required
                      placeholder="Corolla"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                    <input
                      value={newVehicle.year}
                      onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                      placeholder="2020"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reg. number *</label>
                    <input
                      value={newVehicle.registration_number}
                      onChange={(e) => setNewVehicle({ ...newVehicle, registration_number: e.target.value })}
                      required
                      placeholder="AAA-0000"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Colour</label>
                    <input
                      value={newVehicle.colour}
                      onChange={(e) => setNewVehicle({ ...newVehicle, colour: e.target.value })}
                      placeholder="White"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fuel type</label>
                    <select
                      value={newVehicle.fuel_type}
                      onChange={(e) => setNewVehicle({ ...newVehicle, fuel_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                    >
                      {FUEL_TYPES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle class</label>
                    <select
                      value={newVehicle.vehicle_class}
                      onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_class: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                    >
                      {VEHICLE_CLASSES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newVehicle.is_default}
                        onChange={(e) => setNewVehicle({ ...newVehicle, is_default: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      Set as default vehicle
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addingVehicle}
                  className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold rounded-xl transition text-sm"
                >
                  {addingVehicle ? 'Adding…' : 'Add Vehicle'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
