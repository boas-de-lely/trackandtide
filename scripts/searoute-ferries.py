#!/usr/bin/env python3
"""
Generate realistic ferry route paths using searoute maritime routing.

searoute uses a network of maritime routes to calculate paths that:
- Follow actual sea lanes
- Navigate through straits and channels
- Never cross land
- Produce smooth, realistic paths

This is much better than manual waypoints or OSM relation extraction
because it guarantees the path is on water and follows real shipping routes.

Run: python scripts/searoute-ferries.py
"""

import json
import os
import sys
import time
import searoute as sr


def load_ferries(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def lonlat_to_latlon(coords):
    """Convert [[lon, lat], ...] to [[lat, lon], ...] for Leaflet."""
    return [[pt[1], pt[0]] for pt in coords]


def get_searoute_path(lat1, lon1, lat2, lon2):
    """
    Get maritime route between two points.
    searoute expects [lon, lat] and returns GeoJSON with [lon, lat] coords.
    Returns list of [lat, lon] pairs.
    """
    # Add small jitter to avoid caching issues for nearly-identical endpoints
    try:
        route = sr.searoute([lon1, lat1], [lon2, lat2])
        coords = route.get('geometry', {}).get('coordinates', [])
        if coords and len(coords) >= 2:
            return lonlat_to_latlon(coords)
    except Exception as e:
        print(f"    searoute error: {e}")
    return None


def simplify_coords(coords, max_points=30):
    """
    Simplify a coordinate list to a maximum number of points.
    Uses simple subsampling - keeps start, end, and evenly distributed middle points.
    """
    if len(coords) <= max_points:
        return coords
    
    # Always keep first and last
    result = [coords[0]]
    step = (len(coords) - 2) / (max_points - 2)
    for i in range(1, max_points - 1):
        idx = int(i * step)
        if idx < len(coords):
            result.append(coords[idx])
    result.append(coords[-1])
    return result


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    ferries_path = os.path.join(project_dir, 'ferries.json')
    
    print("Loading ferries.json...")
    data = load_ferries(ferries_path)
    routes = data.get('routes', [])
    print(f"Found {len(routes)} routes")
    
    updated = 0
    failed = 0
    skipped_short = 0
    
    print("\n=== Generating maritime routes with searoute ===\n")
    
    for i, route in enumerate(routes):
        route_id = route.get('id', '')
        route_name = route.get('name', '')
        existing_coords = route.get('coords', [])
        
        if len(existing_coords) < 2:
            print(f"  [{i+1}/{len(routes)}] {route_id}: {route_name} - SKIP (no coords)")
            continue
        
        start = existing_coords[0]
        end = existing_coords[-1]
        lat1, lon1 = start[0], start[1]
        lat2, lon2 = end[0], end[1]
        
        # For very short routes (< 15km), keep straight line
        from math import radians, sin, cos, sqrt, atan2
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371
            dlat = radians(lat2 - lat1)
            dlon = radians(lon2 - lon1)
            a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
            return R * 2 * atan2(sqrt(a), sqrt(1-a))
        
        dist = haversine(lat1, lon1, lat2, lon2)
        
        if dist < 10:
            skipped_short += 1
            print(f"  [{i+1}/{len(routes)}] {route_id}: {route_name} - SKIP (short: {dist:.0f}km, straight line)")
            continue
        
        new_coords = get_searoute_path(lat1, lon1, lat2, lon2)
        
        if new_coords and len(new_coords) >= 2:
            # Simplify if too many points
            new_coords = simplify_coords(new_coords, max_points=40)
            route['coords'] = new_coords
            updated += 1
            print(f"  [{i+1}/{len(routes)}] {route_id}: {route_name} - OK ({len(existing_coords)}->{len(new_coords)} pts, {dist:.0f}km)")
        else:
            failed += 1
            print(f"  [{i+1}/{len(routes)}] {route_id}: {route_name} - FAILED (keeping existing {len(existing_coords)} pts)")
        
        # Small delay to avoid overwhelming the library
        time.sleep(0.05)
    
    # Write updated file
    output_path = ferries_path
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n=== Results ===")
    print(f"Updated: {updated} routes")
    print(f"Failed:  {failed} routes")
    print(f"Skipped (short): {skipped_short} routes")
    print(f"Total:   {len(routes)} routes")
    print(f"\nOutput written to: {output_path}")


if __name__ == '__main__':
    main()
