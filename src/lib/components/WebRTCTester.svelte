<script lang="ts">
  import { _ } from 'svelte-i18n';
  console.log('WebRTCTester script loaded');
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();

  let testResults = $state({
    browserSupport: {},
    iceServers: [],
    networkInfo: {},
    connectivityTests: {},
    stunTests: {},
    turnTests: {},
    portTests: {},
    throughputTests: {},
    symmetricNAT: null,
    vpnDetection: {
      isVpnDetected: false,
      publicIPs: [],
      ipLocations: {}
    }
  });

  let isTestingInProgress = $state(false);
  let testProgress = $state(0);
  let currentTest = $state('');

  class WebRTCNetworkTester {
  results: any;
  
  constructor() {
    this.results = {
      browserSupport: {},
      iceServers: [],
      networkInfo: {},
      connectivityTests: {},
      stunTests: {},
      turnTests: {},
      portTests: {},
      throughputTests: {},
      symmetricNAT: null,
      vpnDetection: {
        isVpnDetected: false,
        publicIPs: [],
        ipLocations: {}
      }
    };
  }

  async runAllTests() {
    console.log("runAllTests")
    await this.checkBrowserSupport();
    await this.checkNetworkType();
    await this.testICEServers();
    await this.testSTUNConnectivity();
    // await this.testTURNConnectivity();
    await this.checkSymmetricNAT();
    await this.checkVPNandGeolocation();
    await this.testDataChannelThroughput();
    return this.results;
  }
  async checkNetworkType() {
  this.results.networkInfo = {
    type: (navigator.connection && navigator.connection.type) || 'unknown',
    downlink: (navigator.connection && navigator.connection.downlink) || 'unknown',
    rtt: (navigator.connection && navigator.connection.rtt) || 'unknown',
    effectiveType: (navigator.connection && navigator.connection.effectiveType) || 'unknown',
    publicIP: await this.getPublicIP(),
    localIPs: await this.getLocalIPs()
  };
}
async testICEServers() {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add your TURN servers here
  ];

  for (const server of iceServers) {
    const result = await this.testICEServer(server);
    this.results.iceServers.push({
      server: server.urls,
      connectivity: result.success,
      responseTime: result.responseTime,
      error: result.error
    });
  }
}
async testSTUNConnectivity() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      this.results.stunTests.working = false;
      resolve();
    }, 5000);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (event.candidate.type === 'srflx') {
          this.results.stunTests = {
            working: true,
            publicIP: event.candidate.address,
            port: event.candidate.port
          };
          clearTimeout(timeout);
          resolve();
        }
      }
    };

    pc.createDataChannel('test');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(error => {
        this.results.stunTests.error = error.toString();
        resolve();
      });
  });
}
async checkSymmetricNAT() {
  // Test by connecting to multiple STUN servers and comparing the mapped addresses
  const servers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302'
  ];
  
  const mappedAddresses = await Promise.all(
    servers.map(server => this.getMappedAddress(server))
  );
  
  this.results.symmetricNAT = new Set(mappedAddresses).size > 1;
}
async testDataChannelThroughput() {
  const pc1 = new RTCPeerConnection();
  const pc2 = new RTCPeerConnection();
  const dc1 = pc1.createDataChannel('throughput-test');
  
  const testData = new Array(1024 * 1024).fill('X').join(''); // 1MB of data
  let startTime;

  return new Promise((resolve) => {
    dc1.onopen = () => {
      startTime = performance.now();
      dc1.send(testData);
    };

    pc2.ondatachannel = (event) => {
      const dc2 = event.channel;
      dc2.onmessage = () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const throughput = (testData.length / (duration / 1000)) / (1024 * 1024); // MB/s

        this.results.throughputTests = {
          duration: duration,
          throughputMBps: throughput,
          latency: duration / 2 // Approximate RTT
        };
        resolve();
      };
    };

    // Connect the peers
    this.connectPeers(pc1, pc2);
  });
}
async checkBrowserSupport() {
  this.results.browserSupport = {
    'WebRTC API': typeof RTCPeerConnection !== 'undefined',
    'Data Channels': typeof RTCPeerConnection !== 'undefined' && 
                    'createDataChannel' in RTCPeerConnection.prototype,
    'Network Information': typeof navigator.connection !== 'undefined',
    'WebRTC Statistics': typeof RTCPeerConnection !== 'undefined' && 
                        'getStats' in RTCPeerConnection.prototype,
    'Screen Sharing': typeof navigator.mediaDevices !== 'undefined' && 
                     'getDisplayMedia' in navigator.mediaDevices
  };
  return this.results.browserSupport;
}
  async getPublicIP() {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve('unknown'), 5000);
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            if (event.candidate.type === 'srflx') {
              clearTimeout(timeout);
              resolve(event.candidate.address);
              pc.close();
            }
          }
        };
        
        pc.createDataChannel('');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => resolve('unknown'));
      });
    } catch (error) {
      return 'unknown';
    }
  }

  async getLocalIPs() {
    try {
      const pc = new RTCPeerConnection();
      const localIPs = new Set();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(['unknown']), 1000);
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            if (event.candidate.type === 'host') {
              localIPs.add(event.candidate.address);
            }
          } else {
            // ICE gathering complete
            clearTimeout(timeout);
            pc.close();
            resolve(Array.from(localIPs));
          }
        };
        
        pc.createDataChannel('');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => resolve(['unknown']));
      });
    } catch (error) {
      return ['unknown'];
    }
  }

  async testICEServer(server) {
    const pc = new RTCPeerConnection({ iceServers: [server] });
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        resolve({
          success: false,
          responseTime: null,
          error: 'Timeout'
        });
      }, 5000);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // If we get any ICE candidate, the server is working
          const endTime = performance.now();
          clearTimeout(timeout);
          pc.close();
          resolve({
            success: true,
            responseTime: endTime - startTime,
            error: null
          });
        }
      };

      // Create data channel and offer to trigger ICE gathering
      pc.createDataChannel('test');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(error => {
          clearTimeout(timeout);
          pc.close();
          resolve({
            success: false,
            responseTime: null,
            error: error.toString()
          });
        });
    });
  }

  async getMappedAddress(stunServer) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: stunServer }]
    });
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        resolve(null);
      }, 5000);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (event.candidate.type === 'srflx') {
            clearTimeout(timeout);
            pc.close();
            resolve(event.candidate.address + ':' + event.candidate.port);
          }
        } else if (!event.candidate) {
          // ICE gathering completed without finding a srflx candidate
          clearTimeout(timeout);
          pc.close();
          resolve(null);
        }
      };

      // Create data channel and offer to trigger ICE gathering
      pc.createDataChannel('nat-test');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          pc.close();
          resolve(null);
        });
    });
  }

  async connectPeers(pc1, pc2) {
    try {
      // Create and set local description for pc1
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);

      // Set remote description for pc2 and create answer
      await pc2.setRemoteDescription(offer);
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);

      // Set remote description for pc1
      await pc1.setRemoteDescription(answer);

      // Handle ICE candidates
      pc1.onicecandidate = (event) => {
        if (event.candidate) {
          pc2.addIceCandidate(event.candidate)
            .catch(e => console.error('Error adding ICE candidate to pc2:', e));
        }
      };

      pc2.onicecandidate = (event) => {
        if (event.candidate) {
          pc1.addIceCandidate(event.candidate)
            .catch(e => console.error('Error adding ICE candidate to pc1:', e));
        }
      };
    } catch (__error) {
      console.error('Error connecting peers:', __error);
      throw __error;
    }
  }

  async checkVPNandGeolocation() {
    console.log("checkVPNandGeolocation")
    // Get all public IPs through different STUN servers
    const stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302'
    ];
    
    const publicIPs = new Set();
    
    // Collect all public IPs
    for (const server of stunServers) {
      const ip = await this.getMappedAddress(server);
      if (ip) {
        const ipOnly = ip.split(':')[0];
        publicIPs.add(ipOnly);
      }
    }

    const uniqueIPs = Array.from(publicIPs);
    this.results.vpnDetection.publicIPs = uniqueIPs;
    console.log("checkVPNandGeolocation done",uniqueIPs)
    
    // Multiple public IPs might indicate VPN usage
    this.results.vpnDetection.isVpnDetected = uniqueIPs.length > 1;

    // Get geolocation for each IP
    for (const ip of uniqueIPs) {
      try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        if (!response.ok) {
          throw new Error('IP lookup failed');
        }
        
        const data = await response.json();
        
        if (data.status === 'fail') {
          throw new Error(data.message || 'IP lookup failed');
        }
        
        this.results.vpnDetection.ipLocations[ip] = {
          country: data.country,
          city: data.city,
          region: data.regionName,
          org: data.org || data.isp
        };
      } catch (_error) {
        console.error(`Failed to get location for IP ${ip}:`, _error);
        this.results.vpnDetection.ipLocations[ip] = {
          error: 'Location lookup failed'
        };
      }
      
      // Add delay to respect rate limits (45 requests per minute = ~1.33s between requests)
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}

  async function startTests() {
    console.log("startTests")
    isTestingInProgress = true;
    testProgress = 0;
    currentTest = 'Initializing tests...';

    const tester = new WebRTCNetworkTester();
    
    try {
      // Run tests sequentially and update progress
      currentTest = 'Checking browser support...';
      await tester.checkBrowserSupport();
      testResults.browserSupport = tester.results.browserSupport;

      currentTest = 'Checking network information...';
      await tester.checkNetworkType();
      testResults.networkInfo = tester.results.networkInfo;

      currentTest = 'Testing ICE servers...';
      await tester.testICEServers();
      testResults.iceServers = tester.results.iceServers;

      currentTest = 'Testing STUN connectivity...';
      await tester.testSTUNConnectivity();
      testResults.stunTests = tester.results.stunTests;

      currentTest = 'Checking NAT type...';
      await tester.checkSymmetricNAT();
      testResults.symmetricNAT = tester.results.symmetricNAT;

      currentTest = 'Checking VPN and geolocation...';
      await tester.checkVPNandGeolocation();
      testResults.vpnDetection = tester.results.vpnDetection;

      currentTest = 'Testing data channel throughput...';
      await tester.testDataChannelThroughput();
      testResults.throughputTests = tester.results.throughputTests;
      
      testProgress = 100;
    } catch (_error) {
      console.error('Error during WebRTC tests:', _error);
    } finally {
      isTestingInProgress = false;
      currentTest = 'Tests completed';
    }
  }

  function closeModal() {
    dispatch('close');
  }

  async function runNetworkTests() {
    const tester = new WebRTCNetworkTester();
    const results = await tester.runAllTests();
    
    console.log($_('webrtc_test_results'), results);
    
    // Example of how to interpret results
    if (results.symmetricNAT) {
      console.warn($_('webrtc_warn_symmetric_nat'));
    }
    
    if (!results.stunTests.working) {
      console.warn($_('webrtc_warn_stun_failed'));
    }
    
    if (results.throughputTests.throughputMBps < 1) {
      console.warn($_('webrtc_warn_low_throughput'));
    }
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 sm:p-0">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[95vw] sm:max-w-4xl mx-auto max-h-[90vh] overflow-y-auto relative">
    <!-- Add sticky header -->
    <div class="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 sm:p-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{$_('webrtc_network_test')}</h2>
        <button
          class="p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          onclick={closeModal}
          title={$_('webrtc_close')}
          aria-label={$_('webrtc_close')}
        >
          ✕
        </button>
      </div>
    </div>

    <div class="p-4 sm:p-6">
      {#if !isTestingInProgress && testProgress === 0}
        <button 
          class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
          onclick={startTests}
          ontouchend={(e) => {e.preventDefault(); startTests()}}
        >
          {$_('start_network_tests')}
        </button>
      {/if}

      {#if isTestingInProgress || true}
        <div class="mb-4">
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{currentTest}</div>
          <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style="width: {testProgress}%"
            ></div>
          </div>
        </div>
      {/if}

      {#if testProgress === 100 || true}
        <div class="space-y-4">
          <!-- Browser Support -->
          <div class="border dark:border-gray-700 rounded-lg p-3 sm:p-4">
            <h3 class="font-bold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">{$_('browser_support')}</h3>
            {#each Object.entries(testResults.browserSupport) as [feature, supported]}
              <div class="flex justify-between text-xs sm:text-sm">
                <span class="text-gray-600 dark:text-gray-400">{feature}</span>
                <span class={supported ? 'text-green-500' : 'text-red-500'}>
                  {supported ? '✓' : '✗'}
                </span>
              </div>
            {/each}
          </div>

          <!-- Network Info -->
          <div class="border dark:border-gray-700 rounded-lg p-3 sm:p-4">
            <h3 class="font-bold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">{$_('network_information')}</h3>
            {#each Object.entries(testResults.networkInfo) as [key, value]}
              <div class="flex justify-between text-xs sm:text-sm break-all">
                <span class="text-gray-600 dark:text-gray-400 mr-2">{key}</span>
                <span class="text-gray-900 dark:text-white text-right">{value}</span>
              </div>
            {/each}
          </div>

          <!-- STUN/TURN Tests -->
          <div class="border dark:border-gray-700 rounded-lg p-3 sm:p-4">
            <h3 class="font-bold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">{$_('connectivity_tests')}</h3>
            <div class="text-xs sm:text-sm">
              <div class="flex justify-between mb-2">
                <span class="text-gray-600 dark:text-gray-400">{$_('stun_connectivity')}</span>
                <span class={testResults.stunTests.working ? 'text-green-500' : 'text-red-500'}>
                  {testResults.stunTests.working ? '✓ {$_("working")}' : '✗ {$_("failed")}'}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">{$_('nat_type')}</span>
                <span class={testResults.symmetricNAT ? 'text-red-500' : 'text-green-500'}>
                  {testResults.symmetricNAT ? $_('symmetric_nat_warning') : $_('non_symmetric_nat')}
                </span>
              </div>
            </div>
          </div>

          <!-- Throughput Tests -->
          {#if testResults.throughputTests.throughputMBps}
            <div class="border dark:border-gray-700 rounded-lg p-3 sm:p-4">
              <h3 class="font-bold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">Performance</h3>
              <div class="text-xs sm:text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Throughput</span>
                  <span class="text-gray-900 dark:text-white">
                    {testResults.throughputTests.throughputMBps.toFixed(2)} MB/s
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Latency</span>
                  <span class="text-gray-900 dark:text-white">
                    {testResults.throughputTests.latency.toFixed(0)} ms
                  </span>
                </div>
              </div>
            </div>
          {/if}

          <!-- VPN Detection -->
          <div class="border dark:border-gray-700 rounded-lg p-3 sm:p-4">
            <h3 class="font-bold mb-2 text-gray-900 dark:text-white text-sm sm:text-base">VPN Detection</h3>
            <div class="text-xs sm:text-sm">
              <div class="flex justify-between mb-2">
                <span class="text-gray-600 dark:text-gray-400">VPN Detected</span>
                <span class={testResults.vpnDetection?.isVpnDetected ? 'text-yellow-500' : 'text-green-500'}>
                  {testResults.vpnDetection?.isVpnDetected ? 'Yes' : 'No'}
                </span>
              </div>
              
              {#if testResults.vpnDetection?.publicIPs}
                <div class="mt-2">
                  <h4 class="font-semibold mb-1 text-gray-800 dark:text-gray-300">Detected IP Addresses:</h4>
                  {#each testResults.vpnDetection.publicIPs as ip}
                    <div class="mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div class="font-mono text-gray-700 dark:text-gray-300 break-all">{ip}</div>
                      {#if testResults.vpnDetection.ipLocations[ip]}
                        <div class="text-xs text-gray-600 dark:text-gray-400">
                          {#if !testResults.vpnDetection.ipLocations[ip].error}
                            Location: {testResults.vpnDetection.ipLocations[ip].city}, 
                            {testResults.vpnDetection.ipLocations[ip].region}, 
                            {testResults.vpnDetection.ipLocations[ip].country}
                            <br>
                            Organization: {testResults.vpnDetection.ipLocations[ip].org}
                          {:else}
                            {testResults.vpnDetection.ipLocations[ip].error}
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div> 