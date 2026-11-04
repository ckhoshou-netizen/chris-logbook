#!/usr/bin/env python3
"""Normalize the official complete CNF 2015 CSV ZIP; no scraping or API key."""
import argparse,collections,csv,datetime,hashlib,io,json,re,urllib.request,zipfile
from decimal import Decimal
from pathlib import Path
URL='https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip'
MAP={'calories':('208','kCal'),'protein':('203','g'),'carbs':('205','g'),'fat':('204','g'),'fibre':('291','g'),'sugar':('269','g'),'sodium':('307','mg')}
GROUPS={'1','2','4','5','9','10','11','12','13','15','16','17','20'}
BRANDED=re.compile(r'®|™|\b(?:McDonald|Burger King|KFC|Taco Bell|Kellogg|General Mills|Quaker|Kraft|Nestl[eé]|Dannon|Danone)\b',re.I)
def build(source,output,retrieved_at=None):
 raw=Path(source).read_bytes();z=zipfile.ZipFile(io.BytesIO(raw))
 def table(name):
  content=z.read(name)
  try:text=content.decode('utf-8-sig')
  except UnicodeDecodeError:text=content.decode('cp1252')
  return list(csv.DictReader(io.StringIO(text)))
 # Reject change-only archives: the full source tables are mandatory.
 names=table('FOOD NAME.csv');definitions={r['NutrientID']:r for r in table('NUTRIENT NAME.csv')}
 for key,(nid,unit) in MAP.items():assert definitions[nid]['NutrientUnit']==unit,(key,nid)
 nutrients=collections.defaultdict(dict)
 for r in table('NUTRIENT AMOUNT.csv'):
  if r['NutrientID'] in {v[0] for v in MAP.values()}:
   assert r['NutrientID'] not in nutrients[r['FoodID']],('Duplicate nutrient',r['FoodID'],r['NutrientID'])
   nutrients[r['FoodID']][r['NutrientID']]=r
 groups={r['FoodGroupID']:r['FoodGroupName'] for r in table('FOOD GROUP.csv')}
 sources={r['FoodSourceID']:r for r in table('FOOD SOURCE.csv')}
 measures={r['MeasureID']:r for r in table('MEASURE NAME.csv')};portions=collections.defaultdict(list)
 for r in table('CONVERSION FACTOR.csv'):
  value=Decimal(r['ConversionFactorValue'])
  if value>0 and r['MeasureID'] in measures:
   m=measures[r['MeasureID']];portions[r['FoodID']].append({'id':r['MeasureID'],'label':m['MeasureDescription'],'grams':float(value*100),'conversionFactor':r['ConversionFactorValue']})
 retrieved=retrieved_at or datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
 foods=[];excluded=collections.Counter()
 for r in names:
  if r['FoodGroupID'] not in GROUPS:excluded['outsideWholeFoodGroups']+=1;continue
  if BRANDED.search(r['FoodDescription']):excluded['explicitBrand']+=1;continue
  n=nutrients[r['FoodID']];profile={key:float(Decimal(n[nid]['NutrientValue'])) if nid in n and n[nid]['NutrientValue'].strip() else None for key,(nid,_) in MAP.items()}
  if any(profile[k] is None for k in ['calories','protein','carbs','fat']):excluded['incompleteRequiredNutrition']+=1;continue
  assert all(v is None or v>=0 for v in profile.values())
  provenance={'dataset':'Canadian Nutrient File','version':'2015','foodId':r['FoodID'],'foodCode':r['FoodCode'],'originalDescription':r['FoodDescription'],'originalDescriptionFr':r['FoodDescriptionF'],'groupId':r['FoodGroupID'],'group':groups[r['FoodGroupID']],'foodSourceId':r['FoodSourceID'],'foodSource':sources[r['FoodSourceID']].get('FoodSourceDescription',''),'foodDateOfEntry':r['FoodDateOfEntry'],'foodDateOfPublication':r['FoodDateOfPublication'],'basis':'100 g edible portion','nutrients':{key:{'id':nid,'unit':unit,'sourceId':n[nid]['NutrientSourceID'],'dateOfEntry':n[nid]['NutrientDateOfEntry']} for key,(nid,unit) in MAP.items() if nid in n}}
  foods.append({'id':'cnf-2015-'+r['FoodCode'],'createdAt':retrieved,'name':r['FoodDescription'],'brand':'','quantity':100,'unit':'g','grams':100,'nutrition':profile,'source':'Canadian Nutrient File','readOnly':True,'archived':False,'provenance':provenance,'portions':portions[r['FoodID']]})
 foods.sort(key=lambda f:(f['name'].casefold(),f['id']))
 assert len({f['id'] for f in foods})==len(foods)
 result={'dataset':'Canadian Nutrient File','version':'2015','sourceUrl':URL,'retrievedAt':retrieved,'sourceSha256':hashlib.sha256(raw).hexdigest(),'acknowledgement':'Canadian Nutrient File, Health Canada, 2015','sourceFoodCount':len(names),'foodCount':len(foods),'excluded':dict(excluded),'unresolvedMeasureConversions':sum(r['MeasureID'] not in measures for r in table('CONVERSION FACTOR.csv')),'nutrientDefinitions':{k:{'id':nid,'unit':unit,'name':definitions[nid]['NutrientName']} for k,(nid,unit) in MAP.items()},'foods':foods}
 Path(output).parent.mkdir(parents=True,exist_ok=True);Path(output).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8');return result
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--zip',type=Path,default=Path('/tmp/cnf-2015-complete.zip'));p.add_argument('--output',type=Path,default=Path('app/data/cnf-2015.json'));p.add_argument('--download',action='store_true');p.add_argument('--retrieved-at');a=p.parse_args()
 if a.download:
  with urllib.request.urlopen(URL,timeout=60) as response:a.zip.write_bytes(response.read())
 result=build(a.zip,a.output,a.retrieved_at);print(json.dumps({k:result[k] for k in ['version','sourceFoodCount','foodCount','excluded','sourceSha256']}))
