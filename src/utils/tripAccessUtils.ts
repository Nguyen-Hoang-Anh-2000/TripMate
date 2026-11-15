import type { Trip, TripMember, UserProfile } from '../types';

function normalizePhone(phone?: string): string {
  return (phone || '').replace(/[\s\-().]/g, '').trim();
}

export function isIdentityMatchingMember(
  member: Pick<TripMember, 'uid' | 'email' | 'phone'>,
  user?: Pick<UserProfile, 'id' | 'email' | 'phone'> | null
): boolean {
  if (!member || !user || !user.id) return false;
  if (member.uid && member.uid === user.id) return true;

  const memberEmail = (member.email || '').trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  if (memberEmail && userEmail && memberEmail === userEmail) return true;

  const memberPhone = normalizePhone(member.phone);
  const userPhone = normalizePhone(user.phone);
  if (memberPhone && userPhone && memberPhone === userPhone) return true;

  return false;
}

export function isMemberParticipatingForUser(
  member: Pick<TripMember, 'uid' | 'email' | 'phone' | 'invitationStatus'>,
  user?: Pick<UserProfile, 'id' | 'email' | 'phone'> | null
): boolean {
  if (!isIdentityMatchingMember(member, user)) return false;
  if (member.invitationStatus === 'pending' || member.invitationStatus === 'declined') {
    return false;
  }
  return true;
}

export function canUserAccessTrip(
  trip: Pick<Trip, 'creatorId' | 'memberUids' | 'members'>,
  user?: Pick<UserProfile, 'id' | 'email' | 'phone'> | null
): boolean {
  if (!trip || !user || !user.id) return false;

  // 1. Creator always has access
  if (trip.creatorId && trip.creatorId === user.id) {
    return true;
  }

  // 2. Check explicit member list first so pending/declined status is honored
  const members = Array.isArray(trip.members) ? trip.members : [];
  const matchingMembers = members.filter((m) => isIdentityMatchingMember(m, user));
  if (matchingMembers.length > 0) {
    return matchingMembers.some(
      (m) => m.invitationStatus !== 'pending' && m.invitationStatus !== 'declined'
    );
  }

  // 3. Fallback to explicit participating UIDs list (if user was recorded there)
  if (Array.isArray(trip.memberUids) && trip.memberUids.includes(user.id)) {
    return true;
  }

  return false;
}

export function filterTripsForUser<T extends Pick<Trip, 'creatorId' | 'memberUids' | 'members'>>(
  trips: T[],
  user?: Pick<UserProfile, 'id' | 'email' | 'phone'> | null
): T[] {
  if (!user || !user.id) return [];
  return trips.filter((t) => canUserAccessTrip(t, user));
}

export function getUserTripsCacheKey(userId?: string | null): string | null {
  return userId ? `tripmate_trips_${userId}` : null;
}
