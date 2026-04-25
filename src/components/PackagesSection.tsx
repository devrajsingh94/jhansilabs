import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { HEALTH_PACKAGES } from '../constants';
import { LabTest } from '../types';

interface PackagesSectionProps {
  onBookNow: (test: LabTest) => void;
}

export const PackagesSection = ({ onBookNow }: PackagesSectionProps) => (
  <div className="py-24 bg-slate-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-slate-900 mb-4">Health Packages</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">Choose from our curated health packages designed for comprehensive wellness monitoring and early detection.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {HEALTH_PACKAGES.map((pkg) => (
          <motion.div 
            key={pkg.id}
            whileHover={{ y: -10 }}
            className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col relative"
          >
            {pkg.tag && (
              <div className="absolute top-0 right-0 z-20">
                <div className="bg-orange-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-lg">
                  {pkg.tag}
                </div>
              </div>
            )}
            
            <div className={`p-10 bg-gradient-to-br ${pkg.color || 'from-blue-600 to-blue-400'} text-white relative overflow-hidden`}>
              <div className="relative z-10">
                <p className="text-xs font-bold opacity-80 mb-4 tracking-widest uppercase">{pkg.label || 'HEALTH PACKAGE'}</p>
                <h3 className="text-3xl font-bold mb-6 leading-tight">{pkg.name}</h3>
                <div className="flex items-baseline gap-3 mb-4">
                  {pkg.originalPrice && (
                    <span className="text-xl opacity-60 line-through font-medium">₹{pkg.originalPrice}</span>
                  )}
                  <span className="text-5xl font-black tracking-tighter">₹{pkg.price}</span>
                </div>
                {pkg.originalPrice && (
                  <div className="inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold">
                    Save ₹{pkg.originalPrice - pkg.price}
                  </div>
                )}
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="p-10 flex-1 flex flex-col">
              <div className="space-y-4 mb-10">
                {pkg.testsIncluded.map((test, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={12} className="text-green-500" />
                    </div>
                    <span className="text-slate-700 font-medium text-sm leading-tight">{test}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  const testObj: LabTest = {
                    id: pkg.id,
                    name: pkg.name,
                    price: pkg.price,
                    category: 'Health Package',
                    description: pkg.description
                  };
                  onBookNow(testObj);
                }}
                className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 mt-auto ${
                  pkg.id === 'pkg-1' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' :
                  pkg.id === 'pkg-2' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' :
                  'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                }`}
              >
                Book Now
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);
