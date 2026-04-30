// Server Component — pure content, no interactivity.
// Imported by both the dedicated policy pages (RSC) and FooterModals (client).
// This is the single source of truth for all policy text.

export function PrivacidadContent() {
  return (
    <>
      <p>Tu privacidad es importante. Esta política explica qué datos se recogen y cómo se usan.</p>

      <h3>Datos que se recogen</h3>
      <ul>
        <li><strong>Nombre y email</strong> — al iniciar sesión con Google o al realizar una compra, para gestionar tu cuenta y tus reservas.</li>
        <li><strong>Datos de pago</strong> — gestionados exclusivamente por Stripe. Nunca se almacenan datos de tarjeta.</li>
        <li><strong>Créditos y reservas</strong> — el saldo de clases compradas se guarda en una base de datos segura asociada a tu email.</li>
      </ul>

      <h3>Cómo se usan</h3>
      <ul>
        <li>Para gestionar tu acceso, reservas y saldo de clases.</li>
        <li>Para enviarte confirmaciones y recordatorios de clase por email.</li>
        <li>No se venden datos a terceros ni se usan con fines publicitarios.</li>
      </ul>

      <h3>Servicios de terceros</h3>
      <ul>
        <li><strong>Google OAuth</strong> — inicio de sesión. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de Google</a>.</li>
        <li><strong>Stripe</strong> — procesamiento de pagos. <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer">Política de Stripe</a>.</li>
        <li><strong>Zoom</strong> — tecnología de aula virtual integrada en la plataforma para la realización de las sesiones. <a href="https://explore.zoom.us/es/privacy/" target="_blank" rel="noopener noreferrer">Política de Zoom</a>.</li>
        <li><strong>Supabase</strong> — base de datos donde se almacenan de forma segura las reservas, el saldo de créditos y los datos de cuenta.</li>
      </ul>

      <h3>Tus derechos</h3>
      <p>Puedes solicitar la eliminación de tus datos en cualquier momento escribiendo a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Cookies</h3>
      <p>Solo se usan cookies estrictamente necesarias para la autenticación (NextAuth). Sin cookies de seguimiento ni publicidad.</p>

      <h3>Cambios en esta política</h3>
      <p>Cualquier cambio relevante se comunicará por email a los usuarios con cuenta activa.</p>
    </>
  );
}

export function TerminosContent() {
  return (
    <>
      <p>Al reservar una sesión o adquirir un pack en este sitio, aceptas las condiciones que se describen a continuación.</p>

      <h3>Servicio</h3>
      <p>Gustavo Torres Guerrero ofrece clases particulares y consultoría en línea en las materias descritas en este sitio. Las sesiones se realizan por defecto en el <strong>aula virtual integrada en la plataforma</strong> (tecnología Zoom SDK), sin necesidad de instalar ningún programa. Si el alumno prefiere usar otra plataforma, puede acordarlo previamente con Gustavo.</p>

      <h3>Pagos</h3>
      <p>Los pagos se procesan de forma segura a través de <strong>Stripe</strong>, integrado directamente en la plataforma. No se almacenan datos de tarjeta. Se aceptan Visa, Mastercard y American Express. Al realizar un pago aceptas también los <a href="https://stripe.com/es/legal" target="_blank" rel="noopener noreferrer">términos de Stripe</a>.</p>

      <h3>Packs de clases</h3>
      <p>Los packs son de uso personal e intransferibles. La validez es de <strong>6 meses</strong> desde la fecha de compra. Los créditos no utilizados al vencimiento caducan sin derecho a reembolso.</p>

      <h3>Cancelaciones y reembolsos</h3>
      <p>Puedes cancelar o reprogramar cualquier clase con al menos <strong>2 horas de antelación</strong>. Para las clases de pack, el crédito se devuelve automáticamente. Para sesiones individuales pagadas, el reembolso está sujeto a la comisión de procesamiento que Stripe cobra por devolver un cargo (generalmente 0,25 € + entre el 1,5 % y el 1,9 % del importe; el resto se reembolsa en 1–3 días hábiles). Las cancelaciones con menos de 2 horas de antelación o las no presentaciones sin aviso no dan derecho a reembolso.</p>
      <p>Para solicitar el reembolso de un pack, si no se ha consumido ninguna clase se aplicará únicamente la comisión de Stripe. Si ya se han consumido clases, cada una se descontará al precio unitario de una sesión individual antes de calcular el reembolso, y se aplicará también la comisión de Stripe sobre el importe restante.</p>

      <h3>Responsabilidad</h3>
      <p>Las clases están orientadas a la formación y apoyo académico. No se garantizan resultados académicos específicos ni se asume responsabilidad por el uso que el alumno haga de los contenidos aprendidos.</p>

      <h3>Propiedad intelectual</h3>
      <p>Los materiales, ejercicios y recursos compartidos durante las sesiones son para uso exclusivo del alumno y no pueden distribuirse ni publicarse sin autorización expresa.</p>

      <h3>Modificaciones</h3>
      <p>Gustavo Torres Guerrero se reserva el derecho de actualizar estos términos. Los cambios relevantes se comunicarán con antelación razonable.</p>

      <h3>Contacto</h3>
      <p>Para cualquier consulta sobre estos términos escribe a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>
    </>
  );
}

export function CancelacionContent() {
  return (
    <>
      <p>Puedes cancelar o reprogramar cualquier clase con al menos <strong>2 horas de antelación</strong>.</p>

      <h3>Clases de pack</h3>
      <p>Si cancelas con suficiente antelación, el crédito se devuelve automáticamente a tu pack y queda disponible para reservar otra clase. Los créditos no caducan de forma anticipada por cancelar — simplemente vuelven a tu saldo.</p>

      <h3>Sesiones individuales pagadas</h3>
      <p>Si cancelas con al menos 2 horas de antelación, el reembolso se tramita en un plazo de 1–3 días hábiles. Ten en cuenta que <strong>Stripe cobra una comisión por devolver un cargo</strong> (generalmente 0,25 € + entre el 1,5 % y el 1,9 % del importe); el importe restante se devuelve íntegramente. Si la cancelación se hace con menos de 2 horas de antelación o no se avisa de la no presentación, no se realizará reembolso.</p>

      <h3>Reembolso de packs</h3>
      <p>Puedes solicitar el reembolso de un pack no vencido. Si no has consumido ninguna clase, se aplica únicamente la comisión de Stripe sobre el importe total. Si ya has consumido alguna clase, cada una se descuenta al precio de una sesión individual antes de calcular el reembolso, y se aplica la comisión de Stripe sobre el importe restante. Por ejemplo: pack de 5 clases (75 €) con 1 clase consumida → reembolso = 75 − 16 − comisión Stripe.</p>

      <h3>Validez de los packs</h3>
      <p>Los packs tienen una validez de <strong>6 meses</strong> desde la fecha de compra. Los créditos no consumidos dentro de ese plazo caducan. Las cancelaciones dentro del período de validez siempre devuelven el crédito.</p>

      <h3>Encuentro inicial gratuito</h3>
      <p>El encuentro de 15 minutos es gratuito y se puede cancelar o reprogramar sin límite de tiempo previo.</p>

      <h3>Cómo cancelar o reprogramar</h3>
      <p>Tienes dos formas de hacerlo: usa el enlace de cancelación o reprogramación incluido en el email de confirmación, o accede a tu <strong>área personal</strong> dentro de la plataforma, donde puedes ver todas tus sesiones y gestionarlas directamente. También puedes escribir a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Casos especiales</h3>
      <p>Si surge un imprevisto de última hora, escribe a contacto@gustavoai.dev. Gustavo lo resolverá de forma flexible siempre que sea posible.</p>
    </>
  );
}
