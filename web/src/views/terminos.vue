<template>
  <div class="terms">
    <GlassBackButton />
    <h1 class="title">Términos de Servicio</h1>
    <p class="updated">Syrax Labs Inc · Última actualización: 18 de julio de 2026</p>

    <section v-for="(s, i) in SECTIONS" :key="i" class="sec">
      <h2>{{ i + 1 }}. {{ s.h }}</h2>
      <p v-for="(p, j) in s.p" :key="j">{{ p }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import GlassBackButton from '../components/GlassBackButton.vue';

const SECTIONS = [
  {
    h: 'Aceptación de los términos',
    p: [
      'Estos Términos de Servicio ("Términos") constituyen un acuerdo legal entre tú y Syrax Labs Inc ("Syrax Labs", "nosotros") y regulan tu acceso y uso de la aplicación Hype Call, incluidos sus servicios de transmisión en vivo, video, mensajería, moneda virtual y demás funciones (el "Servicio").',
      'Al crear una cuenta o usar el Servicio aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.',
    ],
  },
  {
    h: 'Elegibilidad',
    p: [
      'Debes tener al menos 18 años (o la mayoría de edad en tu país, si es mayor) para usar el Servicio, transmitir en vivo, comprar moneda virtual o recibir pagos.',
      'Al usar el Servicio declaras que cumples este requisito y que toda la información que proporcionas es veraz. Podemos solicitar verificación de edad o identidad y suspender cuentas que no la superen.',
    ],
  },
  {
    h: 'Tu cuenta',
    p: [
      'Eres responsable de mantener la confidencialidad de tus credenciales y de toda la actividad que ocurra en tu cuenta. Notifícanos de inmediato cualquier uso no autorizado.',
      'No puedes vender, transferir ni ceder tu cuenta. Podemos suspender o cerrar cuentas que incumplan estos Términos.',
    ],
  },
  {
    h: 'Coins (moneda virtual)',
    p: [
      'El Servicio ofrece una moneda virtual llamada "Coins" que puede comprarse con dinero real y usarse únicamente dentro de Hype Call para enviar regalos virtuales, realizar llamadas y acceder a funciones del Servicio.',
      'Los Coins comprados son una licencia limitada, revocable e intransferible para usar funciones del Servicio. No son dinero, no tienen valor monetario fuera del Servicio, no son reembolsables (salvo que la ley aplicable lo exija) y no pueden canjearse por dinero, salvo lo previsto para creadores en la sección de Ganancias.',
      'Los precios de los Coins pueden cambiar en cualquier momento. Las compras se procesan por proveedores de pago externos (por ejemplo, Stripe); al comprar aceptas también los términos de dichos proveedores.',
    ],
  },
  {
    h: 'Regalos virtuales y ganancias de creadores',
    p: [
      'Los espectadores pueden enviar regalos virtuales a los creadores durante las transmisiones. Los regalos recibidos se acreditan al creador como saldo de ganancias, separado de los Coins comprados.',
      'Solo el saldo ganado transmitiendo es susceptible de retiro. Los Coins comprados o recibidos como bono promocional no pueden retirarse en ningún caso.',
      'Los retiros se procesan mediante Stripe Connect y requieren completar la verificación de identidad (KYC) y tener una cuenta bancaria válida. Aplicamos una tasa de conversión y una comisión de retiro visibles en la sección Saldo antes de confirmar cada retiro; ambas pueden actualizarse con efecto prospectivo.',
      'Podemos establecer montos mínimos de retiro, retener o revertir ganancias obtenidas mediante fraude, autocompra artificial, chargebacks o incumplimientos de estos Términos, y suspender pagos mientras investigamos actividad sospechosa.',
    ],
  },
  {
    h: 'Contenido del usuario',
    p: [
      'Conservas los derechos sobre el contenido que crees o transmitas ("Contenido"). Al publicarlo o transmitirlo, otorgas a Syrax Labs una licencia mundial, no exclusiva, gratuita, sublicenciable y transferible para alojar, reproducir, distribuir, comunicar públicamente, adaptar y mostrar tu Contenido con el fin de operar, promocionar y mejorar el Servicio.',
      'Declaras que cuentas con todos los derechos necesarios sobre tu Contenido y que este no infringe derechos de terceros.',
      'Las transmisiones en vivo pueden ser vistas por otros usuarios en tiempo real. Eres el único responsable de lo que transmites.',
    ],
  },
  {
    h: 'Conducta prohibida',
    p: [
      'Al usar el Servicio te comprometes a NO: (a) publicar o transmitir contenido ilegal, sexualmente explícito, violento, de odio, acosador, difamatorio o que explote o ponga en riesgo a menores; (b) suplantar a otras personas o entidades; (c) infringir derechos de propiedad intelectual; (d) recopilar datos de otros usuarios sin autorización; (e) manipular el sistema de Coins, regalos o retiros, incluido el uso de tarjetas robadas, fraude de reembolsos o autocompra para simular ganancias; (f) usar bots, scraping o acceso automatizado; (g) interferir con la seguridad o el funcionamiento del Servicio; (h) usar el Servicio para lavado de dinero o cualquier actividad ilícita.',
      'Podemos retirar contenido, restringir funciones, retener ganancias y suspender o eliminar cuentas que incumplan estas reglas, con o sin previo aviso.',
    ],
  },
  {
    h: 'Moderación y seguridad',
    p: [
      'Podemos, pero no estamos obligados a, supervisar o moderar el contenido y las transmisiones. Los usuarios pueden reportar contenido que consideren infractor.',
      'Cooperaremos con las autoridades competentes cuando la ley lo requiera, incluyendo la comunicación de información de cuentas involucradas en actividades ilegales.',
    ],
  },
  {
    h: 'Propiedad intelectual de Syrax Labs',
    p: [
      'El Servicio, incluidos su software, diseño, marcas, logotipos y contenido propio, pertenece a Syrax Labs Inc o a sus licenciantes y está protegido por leyes de propiedad intelectual. No se te concede ningún derecho sobre ellos salvo la licencia limitada de uso del Servicio.',
    ],
  },
  {
    h: 'Privacidad',
    p: [
      'El tratamiento de tus datos personales se rige por nuestra Política de Privacidad. Al usar el Servicio consientes dicho tratamiento, incluido el necesario para procesar pagos, prevenir fraude y cumplir obligaciones legales.',
    ],
  },
  {
    h: 'Servicios de terceros',
    p: [
      'El Servicio integra proveedores externos (procesamiento de pagos, infraestructura de video, notificaciones). No somos responsables de los servicios de terceros ni de sus términos, y tu uso de ellos puede estar sujeto a sus propias condiciones.',
    ],
  },
  {
    h: 'Suspensión y terminación',
    p: [
      'Puedes dejar de usar el Servicio y solicitar la eliminación de tu cuenta en cualquier momento.',
      'Podemos suspender o terminar tu acceso, total o parcialmente, si incumples estos Términos, si lo exige la ley o si discontinuamos el Servicio. Tras la terminación, los Coins comprados no utilizados se pierden sin derecho a reembolso, salvo que la ley disponga lo contrario; las ganancias legítimas pendientes de retiro se procesarán conforme a la sección de Ganancias, salvo fraude o incumplimiento.',
    ],
  },
  {
    h: 'Exención de garantías',
    p: [
      'El Servicio se proporciona "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un fin particular y no infracción. No garantizamos que el Servicio sea ininterrumpido, seguro o libre de errores.',
    ],
  },
  {
    h: 'Limitación de responsabilidad',
    p: [
      'En la máxima medida permitida por la ley, Syrax Labs Inc no será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de beneficios, datos o fondo de comercio, derivados de tu uso del Servicio.',
      'La responsabilidad total de Syrax Labs por cualquier reclamación relacionada con el Servicio no excederá el mayor de: (a) el importe que nos hayas pagado en los 12 meses anteriores a la reclamación, o (b) 100 USD.',
    ],
  },
  {
    h: 'Indemnización',
    p: [
      'Aceptas indemnizar y mantener indemne a Syrax Labs Inc, sus directivos, empleados y agentes frente a reclamaciones, daños y gastos (incluidos honorarios legales razonables) derivados de tu Contenido, tu uso del Servicio o tu incumplimiento de estos Términos.',
    ],
  },
  {
    h: 'Cambios a los Términos',
    p: [
      'Podemos modificar estos Términos en cualquier momento. Publicaremos la versión vigente en el Servicio y actualizaremos la fecha de "Última actualización". El uso continuado del Servicio tras los cambios constituye tu aceptación.',
    ],
  },
  {
    h: 'Ley aplicable y resolución de disputas',
    p: [
      'Estos Términos se rigen por las leyes del Estado de Delaware, Estados Unidos, sin atender a sus normas de conflicto de leyes.',
      'Cualquier disputa que no pueda resolverse amistosamente se someterá a arbitraje individual, confidencial y vinculante. Renuncias a participar en acciones colectivas en la medida permitida por la ley. Nada de lo anterior limita los derechos irrenunciables que te otorgue la legislación de tu país de residencia.',
    ],
  },
  {
    h: 'Contacto',
    p: [
      'Syrax Labs Inc. Para consultas sobre estos Términos, escríbenos desde la sección de soporte de la aplicación.',
    ],
  },
];
</script>

<style scoped>
.terms {
  height: 100%;
  padding: 54px 18px 44px;
  box-sizing: border-box;
  background: #010101;
  color: #fff;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.title {
  margin: 0 0 4px;
  text-align: center;
  font-size: 20px;
  font-weight: 800;
}
.updated {
  margin: 0 0 22px;
  text-align: center;
  font-size: 12px;
  color: #8a8a93;
}
.sec h2 {
  margin: 20px 0 8px;
  font-size: 15px;
  font-weight: 800;
  color: #c79bff;
}
.sec p {
  margin: 0 0 10px;
  font-size: 13.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
  user-select: text;
}
</style>
