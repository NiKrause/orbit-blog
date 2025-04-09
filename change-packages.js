// update-packages-by-date.mjs
import fs from 'fs';
import semver from 'semver';
import fetch from 'node-fetch'; // Für HTTP-Requests

// Konfiguration
const CUTOFF_DATE = new Date('2025-01-29'); // 11.09.2024 libp2p 2.0.0
const PACKAGE_JSON_PATH = './package.json';

async function getPackageVersions(packageName) {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`);
  const data = await response.json();
  const timeData = data.time || {};

  // Filtere Versionen nach Datum und sortiere sie
  const versions = Object.entries(timeData)
    .filter(([key]) => key !== 'created' && key !== 'modified') // Ignoriere Metadaten
    .map(([version, dateStr]) => ({
      version,
      date: new Date(dateStr),
    }))
    .filter(({ date }) => date <= CUTOFF_DATE)
    .sort((a, b) => semver.rcompare(a.version, b.version));

  return versions;
}

async function updateDependencies() {
  // Lese package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  // Funktion zum Aktualisieren der Dependencies
  const update = async (deps) => {
    const updatedDeps = {};
    for (const [pkg, currentVersion] of Object.entries(deps)) {
      try {
        const versions = await getPackageVersions(pkg);
        if (versions.length > 0) {
          const latestValidVersion = versions[0].version;
          updatedDeps[pkg] = latestValidVersion;
          console.log(`Aktualisiert ${pkg}: ${currentVersion} → ${latestValidVersion}`);
        } else {
          console.warn(`Keine Version vor ${CUTOFF_DATE.toISOString()} für ${pkg}. Behalte ${currentVersion}.`);
          updatedDeps[pkg] = currentVersion;
        }
      } catch (error) {
        console.error(`Fehler bei ${pkg}:`, error.message);
        updatedDeps[pkg] = currentVersion;
      }
    }
    return updatedDeps;
  };

  // Aktualisiere dependencies und devDependencies
  packageJson.dependencies = await update(dependencies);
  packageJson.devDependencies = await update(devDependencies);

  // Schreibe die aktualisierte package.json
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2));
  console.log('package.json erfolgreich aktualisiert!');
}

updateDependencies().catch(console.error);