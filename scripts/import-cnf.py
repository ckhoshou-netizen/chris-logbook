#!/usr/bin/env python3
"""Import the official CNF 2026 tables through Open Canada's public DataStore API."""
import argparse,collections,concurrent.futures,datetime,hashlib,json,re,urllib.parse,urllib.request
from decimal import Decimal
from pathlib import Path
DATASET='1b6139bd-ed7e-4043-bc28-ff00e10f3109'
API='https://open.canada.ca/data/api/3/action/'
RESOURCES={'food_name':'e1ffee62-58cb-4e3e-b359-115c658388ad','food_source':'53819b2a-bf8e-40c1-9a12-0c8897d6dc76','cnf_food_group':'adc5b26e-14ea-4697-b208-bbb311955c81','nutrient_amount':'0ff718fc-1133-4154-80c5-3d619e6c63be','nutrient_name':'e0aca283-16b5-4eba-a54a-4994490a3262','nutrient_source':'76c74969-2599-4ebb-8401-d5aaa60a3100','measure_weight_conversion':'bb76d816-3ac0-4749-8c4b-f0dbfd0fac76','measure_type':'e7eac9fc-b46c-4c18-8729-b962d2412fec','measure_name':'104adbc9-f4cc-40b1-9aaa-08290648e24b'}
MAP={'calories':('208','kilocalorie'),'protein':('203','Gram'),'carbs':('205','Gram'),'fat':('204','Gram'),'fibre':('291','Gram'),'sugar':('269','Gram'),'sodium':('307','Milligram')}
GROUPS={'1','2','4','5','9','10','11','12','13','15','16','17','20'}
BRANDED=re.compile(r'®|™|\b(?:McDonald|Burger King|KFC|Taco Bell|Kellogg|General Mills|Quaker|Kraft|Nestl[eé]|Dannon|Danone)\b',re.I)
def download_table(name,cache):
 params={'resource_id':RESOURCES[name],'limit':10000,'sort':'_id asc'}
 if name=='nutrient_amount':params['filters']=json.dumps({'Nutrient_Code':[v[0] for v in MAP.values()]})
 rows=[];total=None
 while total is None or len(rows)<total:
  params['offset']=len(rows)
  with urllib.request.urlopen(API+'datastore_search?'+urllib.parse.urlencode(params),timeout=60) as response:data=json.load(response)
  assert data['success'];result=data['result'];total=result['total'];assert result['records'];rows.extend(result['records'])
 assert len(rows)==total and len({r['_id'] for r in rows})==total
 data={'datasetId':DATASET,'resourceId':RESOURCES[name],'resourceName':name,'api':API+'datastore_search','filters':json.loads(params.get('filters','{}')),'total':total,'records':rows}
 (cache/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 return name,total

def build(cache,output,retrieved_at=None):
 payload={name:json.loads((cache/(name+'.json')).read_text()) for name in RESOURCES}
 for name,data in payload.items():
  assert data['datasetId']==DATASET and data['resourceId']==RESOURCES[name]
  assert data['total']==len(data['records']) and len({r['_id'] for r in data['records']})==data['total']
 tables={name:data['records'] for name,data in payload.items()}
 defs={r['Nutrient_Code']:r for r in tables['nutrient_name']}
 for k,(nid,unit) in MAP.items():assert defs[nid]['Nutrient_Unit']==unit,(k,nid)
 nutrients=collections.defaultdict(dict)
 for r in tables['nutrient_amount']:
  assert r['Nutrient_Code'] not in nutrients[r['Food_Code']],('Duplicate nutrient',r['Food_Code'],r['Nutrient_Code'])
  nutrients[r['Food_Code']][r['Nutrient_Code']]=r
 groups={r['CNF_Food_Group_Code']:r['CNF_Food_Group_Description_EN'] for r in tables['cnf_food_group']}
 sources={r['Food_Source_Code']:r['Food_Source_Description_EN'] for r in tables['food_source']}
 nutrient_sources={r['Nutrient_Source_Code']:r['Nutrient_Source_Description_EN'] for r in tables['nutrient_source']}
 measure_types={r['Measure_Type_Code']:r['Measure_Type_Description_EN'] for r in tables['measure_type']};assert measure_types['6']=='User-defined'
 measures={r['Measure_Code']:r for r in tables['measure_name']};portions=collections.defaultdict(list);missing_measures=0;excluded_conversion_types=collections.Counter()
 for r in tables['measure_weight_conversion']:
  if r['Measure_Type_Code']!='6':excluded_conversion_types[r['Measure_Type_Code']]+=1;continue
  if r['Measure_Code'] not in measures:missing_measures+=1;continue
  grams=Decimal(r['Measure_Weight_Conversion'])
  if grams<=0:continue
  measure={'id':r['Measure_Code'],'label':measures[r['Measure_Code']]['Measure_Description_and_Unit_EN'],'grams':float(grams),'sourceWeight':r['Measure_Weight_Conversion'],'measureTypeCode':'6','lastUpdated':r['Measure_Weight_Conversion_Last_Updated_Date']}
  assert not any(p['id']==measure['id'] for p in portions[r['Food_Code']]),('Duplicate measure',r)
  portions[r['Food_Code']].append(measure)
 retrieved=retrieved_at or datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
 foods=[];excluded=collections.Counter()
 for r in tables['food_name']:
  if r['CNF_Food_Group_Code'] not in GROUPS:excluded['outsideWholeFoodGroups']+=1;continue
  if BRANDED.search(r['Food_Description_EN']):excluded['explicitBrand']+=1;continue
  n=nutrients[r['Food_Code']];profile={key:float(Decimal(n[nid]['Nutrient_Amount'])) if nid in n and (n[nid]['Nutrient_Amount']or'').strip() else None for key,(nid,_) in MAP.items()}
  if any(profile[k] is None for k in ['calories','protein','carbs','fat']):excluded['incompleteRequiredNutrition']+=1;continue
  assert all(v is None or v>=0 for v in profile.values())
  provenance={'dataset':'Canadian Nutrient File','version':'2026','foodId':r['Food_Code'],'foodCode':r['Food_Code'],'sourceKey':'Food_Code','originalDescription':r['Food_Description_EN'],'originalDescriptionFr':r['Food_Description_FR'],'alternateDescription':r['Alternate_Description_EN'],'alternateDescriptionFr':r['Alternate_Description_FR'],'groupId':r['CNF_Food_Group_Code'],'group':groups[r['CNF_Food_Group_Code']],'foodSourceId':r['Food_Source_Code'],'foodSource':sources[r['Food_Source_Code']],'foodLastUpdated':r['Food_Last_Updated_Date'],'usdaNdbCode':r['USDA_NDB_Code'],'scientificName':r['ScientificName'],'basis':'100 g edible portion','nutrients':{key:{'id':nid,'unit':unit,'sourceId':n[nid]['Nutrient_Source_Code'],'sourceDescription':nutrient_sources[n[nid]['Nutrient_Source_Code']],'lastUpdated':n[nid]['Nutrient_Last_Updated_Date']} for key,(nid,unit) in MAP.items() if nid in n}}
  foods.append({'id':'cnf-2026-'+r['Food_Code'],'createdAt':retrieved,'name':r['Food_Description_EN'],'brand':'','quantity':100,'unit':'g','grams':100,'nutrition':profile,'source':'Canadian Nutrient File','readOnly':True,'archived':False,'provenance':provenance,'portions':portions[r['Food_Code']]})
 foods.sort(key=lambda f:(f['name'].casefold(),f['id']))
 assert len({f['id'] for f in foods})==len(foods)
 hashes={name:hashlib.sha256((cache/(name+'.json')).read_bytes()).hexdigest() for name in RESOURCES}
 result={'dataset':'Canadian Nutrient File','version':'2026','sourceUrl':'https://open.canada.ca/data/en/dataset/'+DATASET,'retrievedAt':retrieved,'sourceSha256':hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest(),'sourceResources':{name:{'resourceId':RESOURCES[name],'total':payload[name]['total'],'sha256':hashes[name],'filters':payload[name].get('filters',{})} for name in RESOURCES},'acknowledgement':'Canadian Nutrient File, Health Canada, 2026','sourceFoodCount':len(tables['food_name']),'foodCount':len(foods),'excluded':dict(excluded),'unresolvedMeasureConversions':missing_measures,'excludedMeasureTypes':dict(excluded_conversion_types),'nutrientDefinitions':{k:{'id':nid,'unit':unit,'name':defs[nid]['Nutrient_Name_EN']} for k,(nid,unit) in MAP.items()},'foods':foods}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');return result
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache-dir',type=Path,default=Path('/tmp/cnf-2026-api'));parser.add_argument('--output',type=Path,default=Path('app/data/cnf-2026.json'));parser.add_argument('--download',action='store_true');parser.add_argument('--retrieved-at');a=parser.parse_args();a.cache_dir.mkdir(parents=True,exist_ok=True)
 if a.download:
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
   for result in executor.map(lambda name:download_table(name,a.cache_dir),RESOURCES):print(result)
 result=build(a.cache_dir,a.output,a.retrieved_at);print(json.dumps({k:result[k] for k in ['version','sourceFoodCount','foodCount','excluded','unresolvedMeasureConversions','sourceSha256']}))
