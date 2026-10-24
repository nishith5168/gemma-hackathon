'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  XCircle,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';
import { RiskLevel } from '@/lib/types';

interface RiskBadgeProps {
  type?: 'risk' | 'band' | 'request' | 'alert' | 'status';
  value: string;
  className?: string;
  showIcon?: boolean;
}

export function RiskBadge({
  type = 'risk',
  value,
  className = '',
  showIcon = true,
}: RiskBadgeProps) {
  const v = value.toLowerCase();

  let bg = 'bg-slate-100';
  let text = 'text-slate-700';
  let border = 'border-slate-300';
  let label = value;
  let Icon: LucideIcon = HelpCircle;

  // Domain Semantic Mappings per DESIGN.md §12.0
  if (v === 'critical' || v === 'out') {
    bg = 'bg-rose-50';
    text = 'text-rose-800';
    border = 'border-rose-200';
    label = v === 'out' ? 'Out of Stock' : 'Critical Shortage Risk';
    Icon = ShieldAlert;
  } else if (v === 'high' || v === 'low') {
    bg = 'bg-amber-50';
    text = 'text-amber-800';
    border = 'border-amber-200';
    label = v === 'low' ? 'Low Stock' : 'High Risk';
    Icon = AlertTriangle;
  } else if (v === 'moderate') {
    bg = 'bg-yellow-50';
    text = 'text-yellow-800';
    border = 'border-yellow-200';
    label = 'Moderate Risk';
    Icon = AlertCircle;
  } else if (v === 'in' || v === 'low_risk' || (type === 'risk' && v === 'low')) {
    bg = 'bg-emerald-50';
    text = 'text-emerald-800';
    border = 'border-emerald-200';
    label = v === 'in' ? 'In Stock' : 'Low Risk';
    Icon = CheckCircle2;
  } else if (v === 'insufficient') {
    bg = 'bg-slate-100';
    text = 'text-slate-700';
    border = 'border-slate-300';
    label = 'Insufficient Data';
    Icon = HelpCircle;
  } else if (v === 'pending') {
    bg = 'bg-indigo-50';
    text = 'text-indigo-800';
    border = 'border-indigo-200';
    label = 'Pending Review';
    Icon = Clock;
  } else if (v === 'confirmed' || v === 'reserved') {
    bg = 'bg-blue-50';
    text = 'text-blue-800';
    border = 'border-blue-200';
    label = v === 'confirmed' ? 'Confirmed' : 'Reserved Hold';
    Icon = CheckCircle2;
  } else if (v === 'collected' || v === 'verified') {
    bg = 'bg-emerald-50';
    text = 'text-emerald-800';
    border = 'border-emerald-200';
    label = v === 'collected' ? 'Collected' : 'Verified';
    Icon = CheckCircle2;
  } else if (v === 'rejected' || v === 'cancelled' || v === 'dismissed') {
    bg = 'bg-rose-50';
    text = 'text-rose-700';
    border = 'border-rose-200';
    label = v.charAt(0).toUpperCase() + v.slice(1);
    Icon = XCircle;
  } else if (v === 'escalated') {
    bg = 'bg-purple-50';
    text = 'text-purple-800';
    border = 'border-purple-200';
    label = 'Escalated (Simulated)';
    Icon = AlertTriangle;
  } else if (v === 'acknowledged') {
    bg = 'bg-sky-50';
    text = 'text-sky-800';
    border = 'border-sky-200';
    label = 'Acknowledged';
    Icon = CheckCircle2;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bg} ${text} ${border} ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{label}</span>
    </span>
  );
}
