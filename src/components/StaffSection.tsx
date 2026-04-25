import React from 'react';
import { motion } from 'motion/react';
import { Mail, Award, Stethoscope } from 'lucide-react';
import { STAFF_MEMBERS } from '../constants';

export const StaffSection = () => (
  <div className="py-20 bg-slate-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-slate-900 mb-4">Meet Our Expert Team</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">Our laboratory is staffed by highly qualified pathologists, hematologists, and technicians dedicated to providing accurate diagnostic results.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {STAFF_MEMBERS.map((staff) => (
          <motion.div 
            key={staff.id}
            whileHover={{ y: -10 }}
            className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100 group"
          >
            <div className="aspect-[4/5] overflow-hidden relative">
              <img src={staff.image} alt={staff.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <div className="flex gap-3">
                  <button className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center text-white hover:bg-blue-600 transition-colors">
                    <Mail size={16} />
                  </button>
                  <button className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center text-white hover:bg-blue-600 transition-colors">
                    <Award size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-1">{staff.name}</h3>
              <p className="text-blue-600 font-bold text-sm mb-3">{staff.role}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Stethoscope size={14} />
                  <span>{staff.specialization}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Award size={14} />
                  <span>{staff.experience} Experience</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);
