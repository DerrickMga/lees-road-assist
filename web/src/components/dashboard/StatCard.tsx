'use client';

import React from 'react';
import Link from 'next/link';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'teal' | 'yellow';
  href?: string;
}

export default function StatCard({ title, value, subtitle, icon, color = 'green', href }: StatCardProps) {
  const colorMap: Record<string, { card: string; iconBg: string; iconText: string }> = {
    green:  { card: 'bg-white border-gray-200',  iconBg: 'bg-green-100',  iconText: 'text-green-600' },
    blue:   { card: 'bg-white border-gray-200',  iconBg: 'bg-blue-100',   iconText: 'text-blue-600' },
    orange: { card: 'bg-white border-gray-200',  iconBg: 'bg-orange-100', iconText: 'text-orange-600' },
    red:    { card: 'bg-white border-gray-200',  iconBg: 'bg-red-100',    iconText: 'text-red-600' },
    purple: { card: 'bg-white border-gray-200',  iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
    teal:   { card: 'bg-white border-gray-200',  iconBg: 'bg-teal-100',   iconText: 'text-teal-600' },
    yellow: { card: 'bg-white border-gray-200',  iconBg: 'bg-yellow-100', iconText: 'text-yellow-600' },
  };

  const { card, iconBg, iconText } = colorMap[color] ?? colorMap.green;

  const inner = (
    <div className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow ${card} ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${iconBg} ${iconText} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
