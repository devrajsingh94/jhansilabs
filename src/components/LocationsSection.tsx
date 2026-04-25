import React from 'react';
import { MapPin, Phone, Clock } from 'lucide-react';
import { LAB_LOCATIONS } from '../constants';

interface LocationsSectionProps {
  onBookHomeCollection: () => void;
}

export const LocationsSection = ({ onBookHomeCollection }: LocationsSectionProps) => (
  <div className="py-20 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-slate-900 mb-4">Our Lab Network</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">Find the nearest Jhansi Labs collection center. We have multiple locations across the city for your convenience.</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        {LAB_LOCATIONS.map((loc) => (
          <div key={loc.id} className="bg-slate-50 rounded-[2rem] overflow-hidden border border-slate-100 hover:border-blue-200 transition-all group flex flex-col">
            <div className="h-48 relative overflow-hidden">
              <img src={loc.image} alt={loc.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              <div className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                <MapPin size={20} />
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-bold text-slate-900">{loc.name}</h3>
                {loc.isMain && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Main</span>}
              </div>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">{loc.address}</p>
              <div className="space-y-4 mb-8 mt-auto">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Phone size={16} className="text-blue-600" />
                  <span>{loc.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Clock size={16} className="text-blue-600" />
                  <span>Mon - Sat: 7:00 AM - 8:00 PM</span>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <a 
                  href={`tel:${loc.phone}`}
                  className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Phone size={16} />
                  Call Now
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-16 bg-slate-900 rounded-[3rem] p-12 text-center text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-3xl font-bold mb-4">Can't visit us?</h3>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">We offer home collection services across the city. Our expert phlebotomists will visit you at your convenience.</p>
          <button 
            onClick={onBookHomeCollection}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          >
            Book Home Collection
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  </div>
);
