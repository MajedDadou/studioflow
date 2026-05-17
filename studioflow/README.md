# StudioFlow

StudioFlow er en lokal webapp til Fotograf Guld / Aarsbilleder. Den erstatter den håndskrevne ordreblok efter en fotosession med en enkel digital arbejdsgang, så medarbejdere kan registrere valgte billeder, produkter, rammer, antal, farvevalg, retouchnoter og status.

Appen erstatter ikke Lightroom og gemmer ikke billeder. Lightroom bruges stadig til visning og valg af billeder, serveren gemmer billedfilerne, og StudioFlow gemmer ordredetaljer samt opretter læsbare tekstfiler i kundemappen.

## Hvad StudioFlow gør

- Opretter kunder, sessioner og ordrer.
- Genererer ordre-ID i formatet `FG-YYYYMMDD-001`.
- Gemmer ordrelinjer med billede, produkt, størrelse, ramme, antal, variant, retouch og noter.
- Viser dashboard med status for nye sessioner, bekræftede ordrer, retouch, print, levering og problemer.
- Opretter `order_info.txt`, `retouch_list.txt` og `print_list.txt`.
- Viser emailkladde til retouchør og logger den, hvis SMTP ikke er sat op.
- Giver kundeprofil med tidligere sessioner og ordrer.

## Hvad StudioFlow ikke gør

- Ingen betaling.
- Ingen faktura.
- Ingen online kundeportal.
- Ingen cloud-login.
- Ingen Lightroom-plugin.
- Ingen AI-udvælgelse.
- Ingen ekstern SaaS-afhængighed.
- Ingen sletning, flytning eller ændring af billedfiler.

## Installation på Windows

1. Installer Python fra `https://www.python.org/downloads/`.
2. Vælg `Add python.exe to PATH` under installationen.
3. Åbn PowerShell i StudioFlow-mappen.
4. Opret et virtuelt miljø:

```powershell
python -m venv .venv
```

5. Aktivér miljøet:

```powershell
.\.venv\Scripts\Activate.ps1
```

6. Installer krav:

```powershell
pip install -r requirements.txt
```

7. Start appen:

```powershell
python app.py
```

Du kan også starte med `run.bat`.

## Åbn appen

På bridge-computeren:

```text
http://localhost:5000
```

Fra en anden computer på samme lokale netværk:

```text
http://studio-bridge:5000
```

Hvis computernavnet ikke virker, brug bridge-computerens lokale IP-adresse:

```text
http://192.168.x.x:5000
```

Windows Firewall skal tillade indgående trafik til Python eller port `5000`.

## Database

SQLite-databasen ligger her:

```text
data/studioflow.db
```

Lav backup ved at kopiere filen, når appen ikke skriver til den:

```powershell
Copy-Item data\studioflow.db backups\studioflow_YYYYMMDD_HHMMSS.db
```

## Servermappe

Gå til `Indstillinger` og sæt `Base servermappe`.

Eksempel til test:

```text
generated_test_server
```

Eksempel i studieproduktion:

```text
\\SERVER\Photos
```

StudioFlow skriver kun genererede tekstfiler i mapper, der ligger under den konfigurerede base servermappe. Hvis en ordre peger udenfor, bliver filskrivning stoppet og ordren kan markeres som `Problem`.

## Sikkerhedsregler

- StudioFlow sletter aldrig billedfiler.
- StudioFlow flytter aldrig billedfiler.
- StudioFlow ændrer aldrig billedfiler.
- StudioFlow sletter ikke kundemapper.
- StudioFlow må oprette mapper, hvis indstillingen er slået til.
- StudioFlow må oprette tekstfiler.
- Hvis en genereret tekstfil allerede findes, oprettes en backup først:

```text
order_info_OLD_YYYYMMDD_HHMMSS.txt
retouch_list_OLD_YYYYMMDD_HHMMSS.txt
print_list_OLD_YYYYMMDD_HHMMSS.txt
```

## Test med falsk mappe

Opret denne mappe:

```text
generated_test_server/Photos/2026-05-13 Familien Hansen
```

Sæt `Base servermappe` til:

```text
generated_test_server
```

Opret en ny session:

- Kunde: Familien Hansen
- Sessionstype: Family shoot
- Fotograf: Martin
- Dato: 13/05/2026
- Servermappe: `generated_test_server/Photos/2026-05-13 Familien Hansen`

Tilføj ordrelinjer:

1. `IMG_0043`, Print, `30x40`, Hvid ramme, antal `2`, Begge, Standard, Nadhif, `Fjern lille mærke på trøje`
2. `IMG_0051`, Digital, `-`, Ingen ramme, antal `1`, Farve, Ingen, `-`, `-`
3. `IMG_0060`, Print, `20x30`, Sort ramme, antal `3`, Sort/hvid, Ekstra, Marija, `Retoucher baggrund`

Bekræft ordren. Forventet resultat:

- Ordren gemmes.
- Ordren får et ordre-ID som `FG-20260513-001`.
- `order_info.txt` oprettes.
- `retouch_list.txt` oprettes med retouchbilleder.
- `print_list.txt` oprettes med print/produktion.
- Dashboard viser ordrestatus.
- Emailpreview kan oprettes og logges uden SMTP.

## Flytning til bridge-computer

1. Kopiér hele `studioflow`-mappen til bridge-computeren, f.eks. `C:\StudioFlow`.
2. Installer Python og requirements.
3. Sæt `Base servermappe` til den rigtige UNC-sti, f.eks. `\\SERVER\Photos`.
4. Test at bridge-computeren kan åbne servermappen i Stifinder.
5. Start appen med `run.bat`.
6. Åbn appen fra showroom og Surface via `http://studio-bridge:5000`.
