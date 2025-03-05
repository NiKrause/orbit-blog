<script lang="ts">

  import { orbitdb, settingsDB, blogName, identity, identities } from './store';
  import { generateMnemonic } from 'bip39'
  import { IPFSAccessController, createOrbitDB } from '@orbitdb/core';
  import { onMount } from 'svelte';
  // let blogName = '';
  let blogDescription = '';
  let seedPhrase = localStorage.getItem('seedPhrase') || generateMnemonic() //please don't put the seedphrase in the db
  let persistentSeedPhrase = localStorage.getItem('seedPhrase')?true:false;


  // let {identity, identities} = await getIdentity()
  // onMount( async () => {
  $:{if($orbitdb){
    console.log('orbitdb', $orbitdb)
    $orbitdb.open('settings', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/settings',
        identity: identity,
        identities: identities,
        AccessController: IPFSAccessController({
          write: ["*"],
        }),
      }).then(_db => {
        console.log('settingsDB', _db)
        $settingsDB = _db;
      }).catch(err => {
        console.log('error', err)
      })
  }}
  // })
    
  //   getIdentity().then(({identity, identities}) => {
  //         $orbitStore.open('settings', {
  //           type: 'documents',
  //           create: true,
  //           overwrite: false,
  //           directory: './orbitdb/settings',
  //           identity,
  //           identities,
  //           AccessController: IPFSAccessController({
  //             write: ["*"],
  //           }),
  //         }).then(_db => {
  //           console.log('settingsDB', _db)
  //           $settingsDB = _db;
  //           // Initialize blogName from the database if it exists
  //           $settingsDB.get('blogName').then(result => {
  //             console.log('blogName',result.value.value)
  //             if (result) blogName = result.value.value;
  //           });
  //           // $settingsDB.put({ _id: 'blogName', value: blogName });
  //         })
  //       })

  // })
  // $:{
  //   // if(blogName){

  //   // }
  // }

  // $:$settingsDB?.events.on('update', async (entry) => {
  //             console.log('Database update:', entry);
  //     if (entry?.payload?.op === 'PUT') {
  //       if(entry.payload.key==='blogName') blogName = entry.payload.value.value;
  //     } else if (entry?.payload?.op === 'DEL') {
  //       if(entry.payload.key==='blogName') blogName = '';
  //     }
  // });
 

  // Reactive statement to initialize localSettings with all values from settingsDB
  // $: if ($settingsDB) {
  // //  console.log('settingsDB', $settingsDB)
  //     $settingsDB.get('blogName').then(( _blogName ) => { 
  //       $blogName = _blogName.value.value;
  //       console.log('blogName',$blogName) 
  //     });
  //     // $settingsDB.get('blogName').then(_blogName => blogName=_blogName.value.value);
  //     // $settingsDB.get('blogDescription').then(_blogDescription => blogDescription=_blogDescription.value.value);
  //     // $settingsDB.drop()
  // }
  // $settingsDB?.del('blogDescription');

  // $: $settingsDB?.put({ _id: 'blogName', value: blogName });
  // $: $settingsDB?.put({ _id: 'blogDescription', value: blogDescription });
  $: localStorage.setItem('seedPhrase', seedPhrase);
  $: (!persistentSeedPhrase)?localStorage.removeItem('seedPhrase'):null;
  $:if($settingsDB) {
    $settingsDB.events.on('update', async (entry) => {
      console.log('Database update:', entry);
      if (entry?.payload?.op === 'PUT') {

        const { _id, ...rest } = entry.payload.value;
        console.log('rest', rest)
        if(entry.payload.key==='blogName') $blogName = rest.value;
  //       if(entry.payload.key==='blogDescription') blogDescription = entry.payload.value.value;
  //       // posts.update(current => [...current, { ...rest, _id: _id }]);
  //     } else if (entry?.payload?.op === 'DEL') {
  //       // posts.update(current => current.filter(post => post._id !== entry.payload.key));
      }
    });
  }

</script>

<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Settings</h2>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Blog Name</label>
    <input type="text" class="w-full p-2 border rounded" 
      value={$blogName}
      on:input= {
        (event) => {
          $settingsDB.put({ _id: 'blogName', value: event.target.value })
        } 
      }
      />
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Blog Description</label>
      <input type="text" class="w-full p-2 border rounded" bind:value={blogDescription} />
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Seed Phrase</label>
    <div class="flex items-center">
      <input type="text" class="w-full p-2 border rounded" bind:value={seedPhrase} />
      <label class="ml-2 text-gray-700 dark:text-gray-300">
        <input type="checkbox" bind:checked={persistentSeedPhrase} class="mr-1" />
        {persistentSeedPhrase ? 'Persistent' : 'Temporary'}
      </label>
    </div>
  </div>
</div>

<style>
  /* Add any additional styles here */
</style> 