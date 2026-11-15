import type { Trip, TripMember, UserProfile } from '../types';

export function buildDefaultAvatar(nameOrSeed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nameOrSeed || 'TripMate')}`;
}

export function isMemberMatchingUser(
  member: Pick<TripMember, 'id' | 'uid' | 'email' | 'phone' | 'name'>,
  user?: Pick<UserProfile, 'id' | 'email' | 'phone' | 'displayName'> | null,
  tripCreatorId?: string
): boolean {
  if (!member || !user) return false;
  if (member.uid && member.uid === user.id) return true;

  const memberEmail = (member.email || '').trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  if (memberEmail && userEmail && memberEmail === userEmail) return true;

  const memberPhone = (member.phone || '').replace(/[\s\-().]/g, '');
  const userPhone = (user.phone || '').replace(/[\s\-().]/g, '');
  if (memberPhone && userPhone && memberPhone === userPhone) return true;

  if (tripCreatorId && tripCreatorId === user.id && member.id === 'm1') {
    const memberName = (member.name || '').trim().toLowerCase();
    const userName = (user.displayName || '').trim().toLowerCase();
    if (!memberName || memberName === 'bạn (trưởng nhóm)' || memberName === 'alex rivera (you)' || (userName && memberName === userName)) {
      return true;
    }
  }

  return false;
}

export function resolveMemberAvatar(
  member: Pick<TripMember, 'id' | 'uid' | 'email' | 'phone' | 'name' | 'avatar'>,
  user?: Pick<UserProfile, 'id' | 'email' | 'phone' | 'displayName' | 'avatar'> | null,
  tripCreatorId?: string
): string {
  if (user?.avatar && isMemberMatchingUser(member, user, tripCreatorId)) {
    return user.avatar;
  }
  return member.avatar || buildDefaultAvatar(member.name || member.id);
}

export function syncUserAvatarIntoTrips(
  trips: Trip[],
  user: Pick<UserProfile, 'id' | 'email' | 'phone' | 'displayName' | 'avatar'>
): { nextTrips: Trip[]; changedTripIds: string[] } {
  if (!user || !user.avatar) {
    return { nextTrips: trips, changedTripIds: [] };
  }

  const changedTripIds: string[] = [];
  const nextTrips = trips.map((trip) => {
    let tripChanged = false;
    const updatedMembers = (trip.members || []).map((m) => {
      if (!isMemberMatchingUser(m, user, trip.creatorId)) {
        return m;
      }
      const needsAvatarUpdate = m.avatar !== user.avatar;
      const needsUidBind = !m.uid && Boolean(user.id);
      const needsEmailBind = !m.email && Boolean(user.email);
      if (!needsAvatarUpdate && !needsUidBind && !needsEmailBind) {
        return m;
      }
      tripChanged = true;
      return {
        ...m,
        avatar: user.avatar,
        ...(user.id ? { uid: m.uid || user.id } : {}),
        ...(user.email ? { email: m.email || user.email } : {}),
      };
    });

    if (!tripChanged) return trip;
    changedTripIds.push(trip.id);
    return {
      ...trip,
      members: updatedMembers,
    };
  });

  return { nextTrips, changedTripIds };
}
