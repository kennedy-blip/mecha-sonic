export type Severity = 'NOMINAL' | 'WATCH' | 'CRITICAL';
export interface Fault { id:string; name:string; short:string; frequency:number; severity:Severity; description:string; aftermarket:[number,number]; oem:[number,number]; hours:[number,number]; }
export const faults:Fault[] = [
{id:'bearing',name:'Worn alternator bearing',short:'Bearing wear',frequency:2650,severity:'WATCH',description:'A high-frequency whine can indicate wear in a rotating bearing.',aftermarket:[45,120],oem:[120,260],hours:[1.5,2.5]},
{id:'belt',name:'Loose serpentine belt',short:'Belt friction',frequency:4200,severity:'WATCH',description:'A rhythmic high-frequency chirp can point to belt slip or glazing.',aftermarket:[25,75],oem:[50,120],hours:[0.5,1.2]},
{id:'knock',name:'Engine connecting rod knock',short:'Engine knock',frequency:1050,severity:'CRITICAL',description:'A repeating low-mid impulse may be consistent with internal engine knock.',aftermarket:[250,800],oem:[600,1500],hours:[8,16]},
{id:'hvac',name:'Compressor overload',short:'Compressor hum',frequency:120,severity:'WATCH',description:'Strong mains harmonics can indicate electrical hum or compressor load.',aftermarket:[180,550],oem:[350,900],hours:[2,5]},
{id:'healthy',name:'Healthy baseline',short:'Healthy baseline',frequency:200,severity:'NOMINAL',description:'No matching fault signature stands out in this sample.',aftermarket:[0,0],oem:[0,0],hours:[0,0]},
{id:'waterpump',name:'Water pump replacement',short:'Water pump',frequency:2200,severity:'WATCH',description:'Inspect for coolant leaks and bearing play.',aftermarket:[60,180],oem:[120,300],hours:[2,4]},
{id:'brakes',name:'Brake pads and rotors',short:'Brake wear',frequency:3000,severity:'WATCH',description:'Inspect pads, rotors and calipers.',aftermarket:[120,300],oem:[200,500],hours:[1.5,3]},
{id:'wheel',name:'Wheel bearing replacement',short:'Wheel bearing',frequency:800,severity:'WATCH',description:'Inspect for play and road-speed-dependent noise.',aftermarket:[80,200],oem:[150,350],hours:[1.5,3]},
{id:'starter',name:'Starter motor replacement',short:'Starter motor',frequency:600,severity:'WATCH',description:'Check the battery and electrical connections first.',aftermarket:[100,250],oem:[220,450],hours:[1,2.5]},
{id:'alternator',name:'Alternator replacement',short:'Alternator',frequency:2650,severity:'WATCH',description:'Test charging voltage before replacement.',aftermarket:[150,350],oem:[300,650],hours:[1,2.5]},
{id:'radiator',name:'Radiator replacement',short:'Radiator',frequency:500,severity:'WATCH',description:'Inspect cooling system for leaks and pressure loss.',aftermarket:[120,300],oem:[250,500],hours:[2,4]},
{id:'fan',name:'Cooling fan replacement',short:'Cooling fan',frequency:700,severity:'WATCH',description:'Inspect the fan, relay, and electrical connections.',aftermarket:[70,200],oem:[150,350],hours:[1,2]},
{id:'washer',name:'Washer drum bearing',short:'Washer bearing',frequency:1800,severity:'WATCH',description:'Inspect drum movement and seals.',aftermarket:[50,150],oem:[100,250],hours:[2,4]},
{id:'blower',name:'HVAC blower motor',short:'Blower motor',frequency:900,severity:'WATCH',description:'Inspect the blower wheel and motor.',aftermarket:[100,250],oem:[200,450],hours:[1.5,3]},
{id:'tensioner',name:'Belt tensioner replacement',short:'Belt tensioner',frequency:2400,severity:'WATCH',description:'Inspect tensioner travel and pulley play.',aftermarket:[45,130],oem:[90,220],hours:[1,2]},
{id:'spark',name:'Spark plug replacement',short:'Spark plugs',frequency:1100,severity:'WATCH',description:'Inspect plugs and ignition coils.',aftermarket:[30,100],oem:[60,180],hours:[1,3]},
];
export const simulations = faults.slice(0,5);
