/** Solicita localização real no navegador; nunca substitui por coordenadas fictícias. */
export function currentLocation(): Promise<{latitude: number; longitude: number}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu navegador não oferece localização.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error('Não foi possível obter sua localização. Verifique o GPS e a permissão do navegador.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}
